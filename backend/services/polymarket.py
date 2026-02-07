"""
Polymarket Service — Fetch NBA games & sports futures
─────────────────────────────────────────────────────
Uses the Gamma API's tag system to fetch:
  1. NBA games (moneyline matchups like "Celtics vs. Pistons")
  2. NBA futures (championship, MVP, awards, etc.)
  3. Other sports events (optional)

Key discovery: tag_id=745 is NBA. Using /events?tag_id=745
returns actual game-by-game matchups, not just futures.
"""

import json
from datetime import datetime, timezone
import httpx
from loguru import logger

POLYMARKET_BASE = "https://gamma-api.polymarket.com"
PAGE_LIMIT = 100

# Tag IDs from the Polymarket /sports endpoint
NBA_TAG_ID = 745


class PolymarketService:

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=20.0)

    # ── NBA Games (moneyline matchups) ───────────────────
    async def get_nba_games(self) -> list[dict]:
        """
        Fetch active NBA game events (e.g. "Celtics vs. Pistons").
        These are the actual game-by-game moneyline markets.
        Returns games sorted by end date (soonest first).
        """
        all_events = await self._fetch_events_by_tag(NBA_TAG_ID, max_pages=3)

        now = datetime.now(timezone.utc).isoformat()
        games = []
        for ev in all_events:
            # Games have "vs." in the title
            if "vs." not in ev.get("title", ""):
                continue
            normalized = self._normalize_game(ev)
            if not normalized:
                continue
            # Filter out past/decided games (100%/0% or game already ended)
            if normalized["game_date"] and normalized["game_date"] < now:
                continue
            if any(t["probability"] >= 0.99 for t in normalized["teams"]):
                continue
            games.append(normalized)

        # Sort by game date (soonest first)
        games.sort(key=lambda g: g["game_date"] or "9999")
        logger.info(f"Fetched {len(games)} upcoming NBA games from Polymarket")
        return games

    # ── NBA Futures (championship, awards, etc.) ─────────
    async def get_nba_futures(self) -> list[dict]:
        """
        Fetch NBA futures/awards (e.g. "2026 NBA Champion", "NBA MVP").
        These are the multi-outcome markets, not individual games.
        Returns futures sorted by volume descending.
        """
        all_events = await self._fetch_events_by_tag(NBA_TAG_ID, max_pages=3)

        futures = []
        for ev in all_events:
            # Futures don't have "vs." in the title
            if "vs." in ev.get("title", ""):
                continue
            normalized = self._normalize_future(ev)
            if normalized:
                futures.append(normalized)

        futures.sort(key=lambda f: f["volume"], reverse=True)
        logger.info(f"Fetched {len(futures)} NBA futures from Polymarket")
        return futures

    # ── Combined: all NBA events ─────────────────────────
    async def get_all_nba(self) -> dict:
        """Return both games and futures in one call."""
        all_events = await self._fetch_events_by_tag(NBA_TAG_ID, max_pages=3)

        now = datetime.now(timezone.utc).isoformat()
        games = []
        futures = []

        for ev in all_events:
            if "vs." in ev.get("title", ""):
                normalized = self._normalize_game(ev)
                if not normalized:
                    continue
                if normalized["game_date"] and normalized["game_date"] < now:
                    continue
                if any(t["probability"] >= 0.99 for t in normalized["teams"]):
                    continue
                games.append(normalized)
            else:
                normalized = self._normalize_future(ev)
                if normalized:
                    futures.append(normalized)

        games.sort(key=lambda g: g["game_date"] or "9999")
        futures.sort(key=lambda f: f["volume"], reverse=True)

        return {"games": games, "futures": futures}

    # ── Search ───────────────────────────────────────────
    async def search_events(self, query: str) -> list[dict]:
        """Search NBA events by keyword."""
        keywords = query.lower().split()
        all_events = await self._fetch_events_by_tag(NBA_TAG_ID, max_pages=3)

        results = []
        for ev in all_events:
            title = (ev.get("title", "") or "").lower()
            desc = (ev.get("description", "") or "").lower()
            combined = f"{title} {desc}"
            if all(kw in combined for kw in keywords):
                if "vs." in ev.get("title", ""):
                    n = self._normalize_game(ev)
                else:
                    n = self._normalize_future(ev)
                if n:
                    results.append(n)

        return results

    # ── Internal: fetch events by tag ────────────────────
    async def _fetch_events_by_tag(self, tag_id: int, max_pages: int = 3) -> list[dict]:
        """Paginate through events filtered by tag ID."""
        all_events = []

        for page in range(max_pages):
            try:
                resp = await self.client.get(
                    f"{POLYMARKET_BASE}/events",
                    params={
                        "tag_id": tag_id,
                        "closed": "false",
                        "limit": PAGE_LIMIT,
                        "offset": page * PAGE_LIMIT,
                        "order": "id",
                        "ascending": "false",
                    },
                )
                resp.raise_for_status()
                events = resp.json()
            except Exception as e:
                logger.error(f"Polymarket fetch page {page} (tag={tag_id}) failed: {e}")
                break

            if not events:
                break

            all_events.extend(events)

        return all_events

    # ── Normalize a game event ───────────────────────────
    def _normalize_game(self, ev: dict) -> dict | None:
        """
        Normalize a game event like "Celtics vs. Pistons" into a clean dict.
        Extracts the two teams and their moneyline probabilities.
        """
        markets = ev.get("markets", [])
        if not markets:
            return None

        # Find the moneyline market
        ml_market = None
        for m in markets:
            st = m.get("sportsMarketType", "")
            if st == "moneyline" or not st:
                ml_market = m
                break

        if not ml_market:
            ml_market = markets[0]

        try:
            outcomes = json.loads(ml_market.get("outcomes", "[]")) if isinstance(ml_market.get("outcomes"), str) else ml_market.get("outcomes", [])
            prices = json.loads(ml_market.get("outcomePrices", "[]")) if isinstance(ml_market.get("outcomePrices"), str) else ml_market.get("outcomePrices", [])
        except (json.JSONDecodeError, TypeError):
            return None

        if len(outcomes) < 2 or len(prices) < 2:
            return None

        # Parse the two teams and their probabilities
        teams = []
        for name, price in zip(outcomes, prices):
            try:
                prob = float(price)
            except (ValueError, TypeError):
                prob = 0.5
            teams.append({"name": name, "probability": round(prob, 4)})

        # Sort so the favorite is first
        teams.sort(key=lambda t: t["probability"], reverse=True)

        return {
            "id": ev.get("id", ""),
            "type": "game",
            "title": ev.get("title", ""),
            "slug": ev.get("slug", ""),
            "description": ev.get("description", ""),
            "image": ev.get("image", ""),
            "category": "NBA",
            "game_date": ev.get("endDate", ""),
            "volume": float(ev.get("volume", 0) or 0),
            "liquidity": float(ev.get("liquidity", 0) or 0),
            "competitive": float(ev.get("competitive", 0) or 0),
            "teams": teams,
            # Keep outcomes format for backwards compat with frontend
            "outcomes": [
                {"name": t["name"], "probability": t["probability"]}
                for t in teams
            ],
            "markets_count": len(markets),
        }

    # ── Normalize a futures event ────────────────────────
    def _normalize_future(self, ev: dict) -> dict | None:
        """
        Normalize a futures event like "2026 NBA Champion" into a clean dict.
        Extracts all outcomes with probabilities.
        """
        markets = ev.get("markets", [])
        outcomes = []

        for m in markets:
            raw_outcomes = m.get("outcomes", "[]")
            raw_prices = m.get("outcomePrices", "[]")

            try:
                outs = json.loads(raw_outcomes) if isinstance(raw_outcomes, str) else raw_outcomes
                prices = json.loads(raw_prices) if isinstance(raw_prices, str) else raw_prices
            except (json.JSONDecodeError, TypeError):
                continue

            if not outs or not prices:
                continue

            question = m.get("question", "")

            # Yes/No market (e.g. "Will the Lakers win the championship?")
            if len(outs) == 2 and "Yes" in outs and "No" in outs:
                yes_idx = outs.index("Yes")
                yes_price = float(prices[yes_idx]) if yes_idx < len(prices) else 0
                if yes_price < 0.005:
                    continue
                name = self._extract_entity(question, ev.get("title", ""))
                outcomes.append({"name": name, "probability": round(yes_price, 4)})
            else:
                for o, p in zip(outs, prices):
                    try:
                        prob = float(p)
                    except (ValueError, TypeError):
                        prob = 0
                    if prob < 0.005:
                        continue
                    outcomes.append({"name": o, "probability": round(prob, 4)})

        if not outcomes:
            return None

        outcomes.sort(key=lambda o: o["probability"], reverse=True)

        return {
            "id": ev.get("id", ""),
            "type": "future",
            "title": ev.get("title", ""),
            "slug": ev.get("slug", ""),
            "image": ev.get("image", ""),
            "category": "NBA",
            "volume": float(ev.get("volume", 0) or 0),
            "liquidity": float(ev.get("liquidity", 0) or 0),
            "end_date": ev.get("endDate", ""),
            "outcomes": outcomes,
            "markets_count": len(markets),
        }

    # ── Helpers ──────────────────────────────────────────
    def _extract_entity(self, question: str, event_title: str) -> str:
        """Extract entity name from 'Will the X win ...' style questions."""
        q = question.strip()
        if q.lower().startswith("will "):
            rest = q[5:]
            if rest.lower().startswith("the "):
                rest = rest[4:]
            for marker in [" win ", " be ", " make ", " finish ", " lead ", " record "]:
                idx = rest.lower().find(marker)
                if idx > 0:
                    return rest[:idx].strip()
        return question[:50] if question else "Unknown"
