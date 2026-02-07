"""
Sports Data Service — Fetch live game data
────────────────────────────────────────────
Skeleton for fetching live/upcoming games from sports data APIs.

TODO: Integrate with a real sports data provider:
  - ESPN API (free, unofficial)
  - The Odds API (https://the-odds-api.com/)
  - API-Sports (https://api-sports.io/)
  - SportsData.io
"""

from typing import Optional
from loguru import logger
from datetime import datetime, timedelta
import random


# ── Team database (logos, abbreviations, etc.) ───────────
TEAMS = {
    "nba": [
        {"id": "lal", "name": "Los Angeles Lakers", "abbr": "LAL", "logo": "/logos/nba/lal.svg", "conference": "West"},
        {"id": "bos", "name": "Boston Celtics", "abbr": "BOS", "logo": "/logos/nba/bos.svg", "conference": "East"},
        {"id": "gsw", "name": "Golden State Warriors", "abbr": "GSW", "logo": "/logos/nba/gsw.svg", "conference": "West"},
        {"id": "mia", "name": "Miami Heat", "abbr": "MIA", "logo": "/logos/nba/mia.svg", "conference": "East"},
        {"id": "phi", "name": "Philadelphia 76ers", "abbr": "PHI", "logo": "/logos/nba/phi.svg", "conference": "East"},
        {"id": "den", "name": "Denver Nuggets", "abbr": "DEN", "logo": "/logos/nba/den.svg", "conference": "West"},
        {"id": "mil", "name": "Milwaukee Bucks", "abbr": "MIL", "logo": "/logos/nba/mil.svg", "conference": "East"},
        {"id": "dal", "name": "Dallas Mavericks", "abbr": "DAL", "logo": "/logos/nba/dal.svg", "conference": "West"},
        {"id": "nyc", "name": "New York Knicks", "abbr": "NYK", "logo": "/logos/nba/nyk.svg", "conference": "East"},
        {"id": "phx", "name": "Phoenix Suns", "abbr": "PHX", "logo": "/logos/nba/phx.svg", "conference": "West"},
    ],
    "nfl": [
        {"id": "kc", "name": "Kansas City Chiefs", "abbr": "KC", "logo": "/logos/nfl/kc.svg", "conference": "AFC"},
        {"id": "sf", "name": "San Francisco 49ers", "abbr": "SF", "logo": "/logos/nfl/sf.svg", "conference": "NFC"},
        {"id": "dal", "name": "Dallas Cowboys", "abbr": "DAL", "logo": "/logos/nfl/dal.svg", "conference": "NFC"},
        {"id": "buf", "name": "Buffalo Bills", "abbr": "BUF", "logo": "/logos/nfl/buf.svg", "conference": "AFC"},
        {"id": "phi", "name": "Philadelphia Eagles", "abbr": "PHI", "logo": "/logos/nfl/phi.svg", "conference": "NFC"},
        {"id": "det", "name": "Detroit Lions", "abbr": "DET", "logo": "/logos/nfl/det.svg", "conference": "NFC"},
    ],
    "mlb": [
        {"id": "nyy", "name": "New York Yankees", "abbr": "NYY", "logo": "/logos/mlb/nyy.svg", "league": "AL"},
        {"id": "lad", "name": "Los Angeles Dodgers", "abbr": "LAD", "logo": "/logos/mlb/lad.svg", "league": "NL"},
        {"id": "hou", "name": "Houston Astros", "abbr": "HOU", "logo": "/logos/mlb/hou.svg", "league": "AL"},
        {"id": "atl", "name": "Atlanta Braves", "abbr": "ATL", "logo": "/logos/mlb/atl.svg", "league": "NL"},
        {"id": "bos", "name": "Boston Red Sox", "abbr": "BOS", "logo": "/logos/mlb/bos.svg", "league": "AL"},
        {"id": "chc", "name": "Chicago Cubs", "abbr": "CHC", "logo": "/logos/mlb/chc.svg", "league": "NL"},
    ],
    "nhl": [
        {"id": "edm", "name": "Edmonton Oilers", "abbr": "EDM", "logo": "/logos/nhl/edm.svg", "conference": "West"},
        {"id": "fla", "name": "Florida Panthers", "abbr": "FLA", "logo": "/logos/nhl/fla.svg", "conference": "East"},
        {"id": "col", "name": "Colorado Avalanche", "abbr": "COL", "logo": "/logos/nhl/col.svg", "conference": "West"},
        {"id": "tor", "name": "Toronto Maple Leafs", "abbr": "TOR", "logo": "/logos/nhl/tor.svg", "conference": "East"},
        {"id": "nyr", "name": "New York Rangers", "abbr": "NYR", "logo": "/logos/nhl/nyr.svg", "conference": "East"},
        {"id": "vgk", "name": "Vegas Golden Knights", "abbr": "VGK", "logo": "/logos/nhl/vgk.svg", "conference": "West"},
    ],
}


class SportsDataService:
    """
    Fetches live/upcoming game data.

    Currently returns mock data. Replace with real API calls
    when you integrate your sports data provider.
    """

    async def get_games(
        self,
        league: Optional[str] = None,
        status: Optional[str] = "live",
        limit: int = 20,
    ) -> list[dict]:
        """
        Get games by league and status.

        TODO: Replace with real API call to your sports data provider.
        """
        leagues = [league.lower()] if league else list(TEAMS.keys())
        games = []

        for lg in leagues:
            teams = TEAMS.get(lg, [])
            if len(teams) < 2:
                continue

            # Generate mock games
            n_games = min(limit, len(teams) // 2)
            shuffled = teams.copy()
            random.seed(hash(f"{lg}_{datetime.now().strftime('%Y-%m-%d')}"))
            random.shuffle(shuffled)

            for i in range(0, n_games * 2, 2):
                if i + 1 >= len(shuffled):
                    break

                home = shuffled[i]
                away = shuffled[i + 1]
                game_id = f"{lg}_{home['id']}_{away['id']}_{datetime.now().strftime('%Y%m%d')}"

                game = {
                    "id": game_id,
                    "league": lg.upper(),
                    "status": status,
                    "home_team": home,
                    "away_team": away,
                    "start_time": (datetime.now() + timedelta(hours=random.randint(0, 8))).isoformat(),
                    "venue": f"{home['name']} Arena",
                }

                if status == "live":
                    game.update({
                        "home_score": random.randint(50, 120) if lg == "nba" else random.randint(0, 7),
                        "away_score": random.randint(50, 120) if lg == "nba" else random.randint(0, 7),
                        "period": f"Q{random.randint(1, 4)}" if lg == "nba" else f"P{random.randint(1, 3)}",
                        "clock": f"{random.randint(0, 11)}:{random.randint(0, 59):02d}",
                    })

                games.append(game)

        return games[:limit]

    async def get_game_by_id(self, game_id: str) -> Optional[dict]:
        """Get a single game by ID. TODO: Real API call."""
        # Parse game ID to reconstruct game
        parts = game_id.split("_")
        if len(parts) < 4:
            return None

        league = parts[0]
        home_id = parts[1]
        away_id = parts[2]

        teams = TEAMS.get(league, [])
        home = next((t for t in teams if t["id"] == home_id), None)
        away = next((t for t in teams if t["id"] == away_id), None)

        if not home or not away:
            return None

        return {
            "id": game_id,
            "league": league.upper(),
            "status": "live",
            "home_team": home,
            "away_team": away,
            "home_score": random.randint(50, 120),
            "away_score": random.randint(50, 120),
            "start_time": datetime.now().isoformat(),
        }

    async def get_game_stats(self, game_id: str) -> dict:
        """Get live game stats. TODO: Real API call."""
        return {
            "possession": {"home": 52.3, "away": 47.7},
            "shots": {"home": 42, "away": 38},
            "turnovers": {"home": 8, "away": 11},
            "note": "Mock data — connect to a real sports API for live stats",
        }
