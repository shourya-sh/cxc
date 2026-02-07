"""
Events API — NBA games & futures from Polymarket
"""

from fastapi import APIRouter, Query
from services.polymarket import PolymarketService

router = APIRouter()
polymarket = PolymarketService()


@router.get("/")
async def get_all_nba():
    """Get all NBA events: games + futures."""
    data = await polymarket.get_all_nba()
    return {
        "games": data["games"],
        "futures": data["futures"],
        "games_count": len(data["games"]),
        "futures_count": len(data["futures"]),
    }


@router.get("/games")
async def get_nba_games():
    """Get NBA game matchups (e.g. Celtics vs. Pistons) with moneyline odds."""
    games = await polymarket.get_nba_games()
    return {"games": games, "count": len(games)}


@router.get("/futures")
async def get_nba_futures():
    """Get NBA futures/awards (e.g. NBA Champion, MVP)."""
    futures = await polymarket.get_nba_futures()
    return {"futures": futures, "count": len(futures)}


@router.get("/search")
async def search_events(
    q: str = Query(..., description="Search query"),
):
    """Search NBA events by keyword."""
    results = await polymarket.search_events(query=q)
    return {"results": results, "count": len(results)}
