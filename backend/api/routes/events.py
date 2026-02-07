"""
Events API — Fetch sports events from Polymarket
"""

from fastapi import APIRouter, Query
from typing import Optional
from services.polymarket import PolymarketService

router = APIRouter()
polymarket = PolymarketService()


@router.get("/")
async def get_sports_events(
    category: Optional[str] = Query(None, description="Filter by category: NBA, NFL, NHL, MLB, etc."),
    min_volume: float = Query(0, description="Minimum volume filter"),
):
    """Get all active sports events from Polymarket."""
    events = await polymarket.get_sports_events(max_pages=5, min_volume=min_volume)

    if category:
        events = [e for e in events if e["category"].lower() == category.lower()]

    return {"events": events, "count": len(events)}


@router.get("/search")
async def search_events(
    q: str = Query(..., description="Search query"),
):
    """Search Polymarket for sports events matching a query."""
    results = await polymarket.search_events(query=q, max_pages=5)
    return {"results": results, "count": len(results)}
