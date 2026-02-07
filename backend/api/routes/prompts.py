"""
Prompts API — Natural language prompt → Gemini → ML → Polymarket → Recommendation
This is the main "smart" endpoint that ties everything together.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.gemini import GeminiService
from services.polymarket import PolymarketService
from ml.predictor import SportsPredictor

router = APIRouter()
gemini = GeminiService()
polymarket = PolymarketService()
predictor = SportsPredictor()


class PromptRequest(BaseModel):
    prompt: str
    context: Optional[dict] = None  # Optional extra context (e.g. selected game)


class ConversationRequest(BaseModel):
    messages: list[dict]  # [{"role": "user", "content": "..."}, ...]


@router.post("/ask")
async def ask_prompt(req: PromptRequest):
    """
    End-to-end pipeline:
    1. User sends natural language prompt
    2. Gemini parses intent → extracts league, teams, bet type
    3. Polymarket fetches matching markets & live odds
    4. ML model runs prediction on the matchup
    5. Returns combined recommendation with confidence scores
    """

    # ── Step 1: Parse with Gemini ─────────────────────────
    parsed = await gemini.parse_sports_prompt(req.prompt)
    if not parsed:
        return {
            "error": "Could not understand the prompt. Try something like: "
                     "'Who should I bet on in Lakers vs Celtics tonight?'"
        }

    # ── Step 2: Find Polymarket bets ──────────────────────
    markets = await polymarket.search_markets(
        query=parsed.get("search_query", req.prompt),
        max_pages=5,
    )

    # ── Step 3: Get ML prediction ─────────────────────────
    ml_prediction = None
    if parsed.get("home_team") and parsed.get("away_team"):
        ml_prediction = predictor.predict(
            league=parsed.get("league", "unknown"),
            home_team=parsed["home_team"],
            away_team=parsed["away_team"],
            features=parsed.get("features"),
        )

    # ── Step 4: Generate recommendation with Gemini ───────
    recommendation = await gemini.generate_recommendation(
        user_prompt=req.prompt,
        parsed_intent=parsed,
        polymarket_data=markets,
        ml_prediction=ml_prediction,
    )

    return {
        "parsed_intent": parsed,
        "markets": markets,
        "ml_prediction": ml_prediction,
        "recommendation": recommendation,
    }


@router.post("/chat")
async def chat(req: ConversationRequest):
    """
    Multi-turn conversation about sports bets.
    Maintains context across messages.
    """
    response = await gemini.chat(req.messages)
    return {"response": response}


@router.post("/explain")
async def explain_bet(req: PromptRequest):
    """
    Explain a bet in plain language — what it means,
    the risk/reward, and the ML model's confidence.
    """
    explanation = await gemini.explain_in_plain_language(req.prompt)
    return {"explanation": explanation}
