"""
Sports Predictor — Inference wrapper
─────────────────────────────────────
Loads trained models and runs predictions.
"""

import os
import json
import joblib
import numpy as np
from loguru import logger

from ml.features import extract_features, get_feature_names, LEAGUE_FEATURES

MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "models"))


class SportsPredictor:
    """Loads per-league models and runs win probability predictions."""

    def __init__(self):
        self._models: dict = {}
        self._metadata: dict = {}
        self._load_all_models()

    def _load_all_models(self):
        """Load all available trained models from MODEL_DIR."""
        if not os.path.exists(MODEL_DIR):
            logger.warning(f"Model directory {MODEL_DIR} not found. No models loaded.")
            return

        for filename in os.listdir(MODEL_DIR):
            if filename.endswith(".pkl"):
                key = filename.replace(".pkl", "")
                path = os.path.join(MODEL_DIR, filename)
                try:
                    self._models[key] = joblib.load(path)
                    logger.info(f"Loaded model: {key}")
                except Exception as e:
                    logger.error(f"Failed to load model {key}: {e}")

            elif filename.endswith("_meta.json"):
                key = filename.replace("_meta.json", "")
                path = os.path.join(MODEL_DIR, filename)
                try:
                    with open(path) as f:
                        self._metadata[key] = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to load metadata {key}: {e}")

    def _get_model(self, league: str, model_type: str = "ensemble"):
        """Get a trained model for a league."""
        key = f"{league.lower()}_{model_type}"
        return self._models.get(key)

    def predict(
        self,
        league: str,
        home_team: str,
        away_team: str,
        features: dict | None = None,
        model_type: str = "ensemble",
    ) -> dict:
        """
        Predict the outcome of a game.

        Returns:
            {
                "home_team": str,
                "away_team": str,
                "home_win_prob": float,
                "away_win_prob": float,
                "predicted_winner": str,
                "confidence": float,
                "model_type": str,
                "recommendation": str,
            }
        """
        model = self._get_model(league, model_type)

        if model is None:
            # No trained model — return dummy prediction
            logger.warning(f"No model for {league}/{model_type}. Returning placeholder.")
            return {
                "home_team": home_team,
                "away_team": away_team,
                "home_win_prob": 0.5,
                "away_win_prob": 0.5,
                "predicted_winner": "uncertain",
                "confidence": 0.0,
                "model_type": model_type,
                "recommendation": "Model not yet trained — run `python -m ml.train` first.",
                "is_placeholder": True,
            }

        # Extract features
        X = extract_features(league, home_team, away_team, raw_stats=features)

        # Predict probabilities
        proba = model.predict_proba(X)[0]
        home_prob = round(float(proba[1]), 4)
        away_prob = round(float(proba[0]), 4)
        confidence = round(abs(home_prob - 0.5) * 2, 4)  # 0 to 1

        predicted_winner = home_team if home_prob > 0.5 else away_team

        # Generate recommendation
        if confidence > 0.7:
            rec = f"Strong bet on {predicted_winner} (confidence: {confidence:.0%})"
        elif confidence > 0.4:
            rec = f"Moderate lean towards {predicted_winner} (confidence: {confidence:.0%})"
        elif confidence > 0.2:
            rec = f"Slight edge for {predicted_winner} — risky bet (confidence: {confidence:.0%})"
        else:
            rec = "Coin flip — no strong recommendation"

        return {
            "home_team": home_team,
            "away_team": away_team,
            "home_win_prob": home_prob,
            "away_win_prob": away_prob,
            "predicted_winner": predicted_winner,
            "confidence": confidence,
            "model_type": model_type,
            "recommendation": rec,
            "is_placeholder": False,
        }

    def list_models(self) -> list[dict]:
        """List all loaded models and their metadata."""
        models = []
        for key, meta in self._metadata.items():
            models.append({
                "key": key,
                "league": meta.get("league"),
                "model_type": meta.get("model_type"),
                "n_features": meta.get("n_features"),
                "n_samples": meta.get("n_samples"),
                "accuracy": meta.get("metrics", {}).get("accuracy"),
                "trained_at": meta.get("trained_at"),
            })
        return models

    def get_model_metrics(self, league: str, model_type: str = "ensemble") -> dict:
        """Get metrics for a specific model."""
        key = f"{league.lower()}_{model_type}"
        meta = self._metadata.get(key)
        if meta:
            return meta.get("metrics", {})
        return {"error": f"No metadata found for {key}"}

    def retrain(self, league: str, model_type: str = "ensemble") -> dict:
        """Trigger retraining for a league model."""
        from ml.train import train_league_model
        try:
            metrics = train_league_model(league, model_type=model_type)
            # Reload the model
            self._load_all_models()
            return {"status": "success", "metrics": metrics}
        except Exception as e:
            return {"status": "error", "error": str(e)}
