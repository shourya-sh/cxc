"""
Events API — Fetch real sports events from Polymarket
"""

from fastapi import APIRouter, Query
from typing import Optional
from services.polymarket import PolymarketService

router = APIRouter()
polymarket = PolymarketService()


@router.get("/")
async def get_sports_events(
    category: Optional[str] = Query(None, description="Filter: NBA, NFL, NHL, MLB, EPL, UCL, FIFA, F1, UFC, Award"),
    min_volume: float = Query(0, description="Minimum volume filter"),
):
    """Get all active sports events from Polymarket with real odds."""
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


# ── Projection endpoint ─────────────────────────────────
from fastapi import HTTPException
from services.gemini import GeminiService

gemini = GeminiService()


@router.get("/{event_id}/projection")
async def get_event_projection(
    event_id: str,
    stake: float = Query(100.0, description="Stake amount in USD"),
    mode: str = Query("market", description="Projection mode: 'market' or 'ai'"),
):
    """Return a projection table for an event's outcomes given a stake.

    mode:
      - market: uses market implied probabilities (no edge)
      - ai: ask Gemini for probability estimates (if available), otherwise falls back to market
    """
    events = await polymarket.get_sports_events(max_pages=5)
    ev = next((e for e in events if str(e.get("id")) == str(event_id)), None)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    outcomes = ev.get("outcomes", [])
    if not outcomes:
        raise HTTPException(status_code=400, detail="No outcomes available for projection")

    # Get predicted probabilities from AI if requested
    predicted: dict | None = None
    if mode == "ai":
        names = [o["name"] for o in outcomes]
        predicted = await gemini.estimate_outcome_probabilities(ev.get("title", ""), names)

    rows = []
    total_expected_profit = 0.0

    for o in outcomes:
        name = o.get("name")
        p_market = float(o.get("probability") or 0)
        p_true = p_market
        if predicted and name in predicted:
            p_true = float(predicted[name])
        # Avoid division by zero
        if p_market <= 0:
            continue
        q = float(stake) / p_market
        expected_return = p_true * q
        profit = expected_return - float(stake)
        roi = profit / float(stake) if float(stake) > 0 else 0.0

        rows.append({
            "name": name,
            "market_probability": round(p_market, 4),
            "predicted_probability": round(p_true, 4),
            "stake": round(float(stake), 2),
            "expected_profit": round(profit, 4),
            "expected_return": round(expected_return, 4),
            "roi": round(roi, 4),
            "market_id": o.get("market_id"),
            "question": o.get("question"),
        })
        total_expected_profit += profit

    rows.sort(key=lambda r: r["expected_profit"], reverse=True)

    summary = {
        "best_outcome": rows[0]["name"] if rows else None,
        "best_expected_profit": round(rows[0]["expected_profit"], 4) if rows else 0,
        "total_expected_profit": round(total_expected_profit, 4),
    }

    return {"event": ev, "rows": rows, "summary": summary}
