"""
Predictions API — Model predictions for NBA games
"""

from fastapi import APIRouter
from services.predictions import PredictionService
from services.polymarket import PolymarketService

router = APIRouter()
predictor = PredictionService()
polymarket = PolymarketService()


@router.get("/")
async def get_predictions():
    """
    Get predictions for all upcoming NBA games on Polymarket.
    Returns each game with both Polymarket odds and our model's prediction.
    """
    games = await polymarket.get_nba_games()
    predictions = predictor.predict_games(games)

    results = []
    for game, pred in zip(games, predictions):
        results.append({
            **game,
            "prediction": pred,
        })

    return {
        "games": results,
        "count": len(results),
        "model_accuracy": 0.656,
    }


@router.get("/model-info")
async def get_model_info():
    """Return model metadata and available analysis charts."""
    return predictor.get_model_info()
