"""
Predictions API — ML model predictions for sports outcomes
"""

from fastapi import APIRouter, Query
from typing import Optional
from pydantic import BaseModel
from ml.predictor import SportsPredictor

router = APIRouter()
predictor = SportsPredictor()


class PredictionRequest(BaseModel):
    game_id: Optional[str] = None
    league: str
    home_team: str
    away_team: str
    features: Optional[dict] = None  # Additional stats / features to pass


class BatchPredictionRequest(BaseModel):
    games: list[PredictionRequest]


@router.post("/predict")
async def predict_outcome(req: PredictionRequest):
    """
    Run the ML model on a game and return win probabilities + recommended bet.
    """
    prediction = predictor.predict(
        league=req.league,
        home_team=req.home_team,
        away_team=req.away_team,
        features=req.features,
    )
    return {
        "game_id": req.game_id,
        "prediction": prediction,
    }


@router.post("/predict/batch")
async def predict_batch(req: BatchPredictionRequest):
    """Run predictions on multiple games at once."""
    results = []
    for game in req.games:
        pred = predictor.predict(
            league=game.league,
            home_team=game.home_team,
            away_team=game.away_team,
            features=game.features,
        )
        results.append({"game_id": game.game_id, "prediction": pred})
    return {"predictions": results}


@router.get("/models")
async def list_models():
    """List available trained models and their metadata."""
    models = predictor.list_models()
    return {"models": models}


@router.get("/models/{league}/accuracy")
async def get_model_accuracy(league: str):
    """Get accuracy metrics for a specific league model."""
    metrics = predictor.get_model_metrics(league)
    return {"league": league, "metrics": metrics}


@router.post("/models/{league}/retrain")
async def retrain_model(league: str):
    """Trigger retraining for a specific league model."""
    result = predictor.retrain(league)
    return {"league": league, "retrain_status": result}
