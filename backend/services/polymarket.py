"""
Polymarket Service — Real sports event scraping
────────────────────────────────────────────────
Fetches active, non-closed sports events from
the Polymarket Gamma API with proper pagination.
Parses multi-outcome markets (e.g. "2026 NBA Champion"
has 30 sub-markets, one per team).
"""

import json
import httpx
from loguru import logger

POLYMARKET_BASE = "https://gamma-api.polymarket.com"
PAGE_LIMIT = 100

SPORTS_KEYWORDS = [
    "nba", "nfl", "nhl", "mlb", "mls",
    "super bowl", "stanley cup", "world series",
    "march madness", "ncaa",
    "premier league", "champions league", "la liga", "bundesliga", "serie a", "ligue 1",
    "fifa", "world cup",
    "f1", "formula 1", "grand prix",
    "ufc", "boxing",
    "tennis", "wimbledon", "us open", "australian open", "french open",
    "olympics",
    "mvp", "rookie of the year", "cy young", "ballon d'or",
]


class PolymarketService:

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=20.0)

    async def get_sports_events(self, max_pages: int = 5, min_volume: float = 0) -> list[dict]:
        """
        Paginate through active Polymarket events and filter to sports.
        Returns normalized data sorted by volume descending.
        """
        sports_events = []

        for page in range(max_pages):
            try:
                resp = await self.client.get(
                    f"{POLYMARKET_BASE}/events",
                    params={
                        "active": "true",
                        "closed": "false",
                        "limit": PAGE_LIMIT,
                        "offset": page * PAGE_LIMIT,
                    },
                )
                resp.raise_for_status()
                events = resp.json()
            except Exception as e:
                logger.error(f"Polymarket fetch page {page} failed: {e}")
                break

            if not events:
                break

            for ev in events:
                title = ev.get("title", "")
                slug = ev.get("slug", "")
                combined = f"{title} {slug}".lower()

                if not any(kw in combined for kw in SPORTS_KEYWORDS):
                    continue

                volume = ev.get("volume", 0) or 0
                if volume < min_volume:
                    continue

                normalized = self._normalize_event(ev)
                if normalized["outcomes"]:
                    sports_events.append(normalized)

        sports_events.sort(key=lambda e: e["volume"], reverse=True)
        logger.info(f"Fetched {len(sports_events)} sports events from Polymarket")
        return sports_events

    async def search_events(self, query: str, max_pages: int = 5) -> list[dict]:
        """Search for events matching a query string."""
        keywords = query.lower().split()
        results = []

        for page in range(max_pages):
            try:
                resp = await self.client.get(
                    f"{POLYMARKET_BASE}/events",
                    params={
                        "active": "true",
                        "closed": "false",
                        "limit": PAGE_LIMIT,
                        "offset": page * PAGE_LIMIT,
                    },
                )
                resp.raise_for_status()
                events = resp.json()
            except Exception as e:
                logger.error(f"Search page {page} failed: {e}")
                break

            if not events:
                break

            for ev in events:
                title = (ev.get("title", "") or "").lower()
                desc = (ev.get("description", "") or "").lower()
                combined = f"{title} {desc}"
                if all(kw in combined for kw in keywords):
                    normalized = self._normalize_event(ev)
                    if normalized["outcomes"]:
                        results.append(normalized)

            if results:
                break

        results.sort(key=lambda e: e["volume"], reverse=True)
        return results

    def _normalize_event(self, ev: dict) -> dict:
        """
        Normalize a Polymarket event with all its sub-markets
        into a flat list of outcomes with probabilities.
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
            market_image = m.get("image", "")

            if len(outs) == 2 and "Yes" in outs and "No" in outs:
                yes_idx = outs.index("Yes")
                yes_price = float(prices[yes_idx]) if yes_idx < len(prices) else 0

                if yes_price < 0.005:
                    continue

                name = self._extract_entity(question, ev.get("title", ""))

                outcomes.append({
                    "name": name,
                    "probability": round(yes_price, 4),
                    "image": market_image,
                    "market_id": m.get("id", ""),
                    "question": question,
                })
            else:
                for o, p in zip(outs, prices):
                    try:
                        prob = float(p)
                    except (ValueError, TypeError):
                        prob = 0
                    if prob < 0.005:
                        continue
                    outcomes.append({
                        "name": o,
                        "probability": round(prob, 4),
                        "image": market_image,
                        "market_id": m.get("id", ""),
                        "question": question if question else o,
                    })

        outcomes.sort(key=lambda o: o["probability"], reverse=True)

        return {
            "id": ev.get("id", ""),
            "title": ev.get("title", ""),
            "slug": ev.get("slug", ""),
            "image": ev.get("image", ""),
            "category": self._detect_category(ev.get("title", "")),
            "volume": float(ev.get("volume", 0) or 0),
            "liquidity": float(ev.get("liquidity", 0) or 0),
            "end_date": ev.get("endDate", ""),
            "outcomes": outcomes,
            "total_markets": len(markets),
        }

    def _extract_entity(self, question: str, event_title: str) -> str:
        """Extract entity name from a question like 'Will the X win ...'"""
        q = question.strip()
        if q.lower().startswith("will "):
            rest = q[5:]
            if rest.lower().startswith("the "):
                rest = rest[4:]
            win_idx = rest.lower().find(" win ")
            if win_idx > 0:
                return rest[:win_idx].strip()
            be_idx = rest.lower().find(" be ")
            if be_idx > 0:
                return rest[:be_idx].strip()
        return question[:50] if question else "Unknown"

    def _detect_category(self, title: str) -> str:
        """Detect the sport category from event title."""
        t = title.lower()
        if "nba" in t or "basketball" in t:
            return "NBA"
        elif "nfl" in t or "super bowl" in t:
            return "NFL"
        elif "nhl" in t or "stanley cup" in t:
            return "NHL"
        elif "mlb" in t or "world series" in t:
            return "MLB"
        elif "premier league" in t:
            return "EPL"
        elif "champions league" in t or "uefa" in t:
            return "UCL"
        elif "fifa" in t or "world cup" in t:
            return "FIFA"
        elif "f1" in t or "formula" in t:
            return "F1"
        elif "ufc" in t or "boxing" in t:
            return "UFC"
        elif "mvp" in t:
            return "Award"
        elif "rookie" in t or "cy young" in t:
            return "Award"
        return "Sports"
