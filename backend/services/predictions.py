"""
Prediction Service — NBA Game Win/Loss + Score Predictions
──────────────────────────────────────────────────────────
Loads the optimized classifier AND the score regressor,
builds live features for upcoming Polymarket games,
and returns predictions with confidence scores + predicted scores.
"""

import os
import pickle
import pandas as pd
from datetime import datetime
from loguru import logger

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BACKEND_DIR, "model", "nba_model_optimized.pkl")
SCORE_MODEL_PATH = os.path.join(BACKEND_DIR, "model", "nba_score_model.pkl")

# Map common Polymarket team names → NBA API city names → team IDs
TEAM_NAME_TO_ID = {
    "hawks": 1610612737, "atlanta": 1610612737, "atlanta hawks": 1610612737,
    "celtics": 1610612738, "boston": 1610612738, "boston celtics": 1610612738,
    "nets": 1610612751, "brooklyn": 1610612751, "brooklyn nets": 1610612751,
    "hornets": 1610612766, "charlotte": 1610612766, "charlotte hornets": 1610612766,
    "bulls": 1610612741, "chicago": 1610612741, "chicago bulls": 1610612741,
    "cavaliers": 1610612739, "cleveland": 1610612739, "cleveland cavaliers": 1610612739, "cavs": 1610612739,
    "mavericks": 1610612742, "dallas": 1610612742, "dallas mavericks": 1610612742, "mavs": 1610612742,
    "nuggets": 1610612743, "denver": 1610612743, "denver nuggets": 1610612743,
    "pistons": 1610612765, "detroit": 1610612765, "detroit pistons": 1610612765,
    "warriors": 1610612744, "golden state": 1610612744, "golden state warriors": 1610612744,
    "rockets": 1610612745, "houston": 1610612745, "houston rockets": 1610612745,
    "pacers": 1610612754, "indiana": 1610612754, "indiana pacers": 1610612754,
    "clippers": 1610612746, "la clippers": 1610612746, "los angeles clippers": 1610612746,
    "lakers": 1610612747, "la lakers": 1610612747, "los angeles lakers": 1610612747, "los angeles": 1610612747,
    "grizzlies": 1610612763, "memphis": 1610612763, "memphis grizzlies": 1610612763,
    "heat": 1610612748, "miami": 1610612748, "miami heat": 1610612748,
    "bucks": 1610612749, "milwaukee": 1610612749, "milwaukee bucks": 1610612749,
    "timberwolves": 1610612750, "minnesota": 1610612750, "minnesota timberwolves": 1610612750, "wolves": 1610612750,
    "pelicans": 1610612740, "new orleans": 1610612740, "new orleans pelicans": 1610612740,
    "knicks": 1610612752, "new york": 1610612752, "new york knicks": 1610612752,
    "thunder": 1610612760, "oklahoma city": 1610612760, "oklahoma city thunder": 1610612760, "okc": 1610612760,
    "magic": 1610612753, "orlando": 1610612753, "orlando magic": 1610612753,
    "76ers": 1610612755, "philadelphia": 1610612755, "philadelphia 76ers": 1610612755, "sixers": 1610612755,
    "suns": 1610612756, "phoenix": 1610612756, "phoenix suns": 1610612756,
    "trail blazers": 1610612757, "portland": 1610612757, "portland trail blazers": 1610612757, "blazers": 1610612757,
    "kings": 1610612758, "sacramento": 1610612758, "sacramento kings": 1610612758,
    "spurs": 1610612759, "san antonio": 1610612759, "san antonio spurs": 1610612759,
    "raptors": 1610612761, "toronto": 1610612761, "toronto raptors": 1610612761,
    "jazz": 1610612762, "utah": 1610612762, "utah jazz": 1610612762,
    "wizards": 1610612764, "washington": 1610612764, "washington wizards": 1610612764,
}


class PredictionService:
    def __init__(self):
        self.model = None
        self.features = None
        self.metrics = None
        self.score_home_model = None
        self.score_away_model = None
        self.score_features = None
        self.score_metrics = None
        self._load_model()
        self._load_score_model()

    def _load_model(self):
        """Load the optimized classifier bundle from the notebook."""
        try:
            with open(MODEL_PATH, "rb") as f:
                bundle = pickle.load(f)
            self.model = bundle["model"]
            self.features = bundle["features"]
            self.metrics = bundle["metrics"]
            self.dropped = bundle.get("dropped_features", [])
            logger.info(f"Loaded classifier: {len(self.features)} features, "
                        f"acc={self.metrics['accuracy']:.4f}")
        except Exception as e:
            logger.error(f"Failed to load classifier: {e}")
            self.model = None

    def _load_score_model(self):
        """Load the score regressor bundle."""
        try:
            with open(SCORE_MODEL_PATH, "rb") as f:
                bundle = pickle.load(f)
            self.score_home_model = bundle["home_model"]
            self.score_away_model = bundle["away_model"]
            self.score_features = bundle["features"]
            self.score_metrics = bundle.get("metrics", {})
            logger.info(f"Loaded score model: {len(self.score_features)} features, "
                        f"home_mae={self.score_metrics.get('home_mae', '?')}")
        except Exception as e:
            logger.error(f"Failed to load score model: {e}")
            self.score_home_model = None

    def resolve_team_id(self, name: str) -> int | None:
        """Resolve a Polymarket team name to an NBA API team ID."""
        key = name.strip().lower()
        return TEAM_NAME_TO_ID.get(key)

    def predict_game(self, home_team: str, away_team: str) -> dict | None:
        """
        Predict a single game outcome.
        Returns prediction dict or None if teams can't be resolved.
        """
        if not self.model:
            logger.warning("Model not loaded, cannot predict")
            return None

        home_id = self.resolve_team_id(home_team)
        away_id = self.resolve_team_id(away_team)

        if not home_id or not away_id:
            logger.warning(f"Could not resolve teams: {home_team} -> {home_id}, {away_team} -> {away_id}")
            return None

        try:
            from data.features import getSingleGameFeatureSet
            full_feature_df = getSingleGameFeatureSet(home_id, away_id)

            # --- Classifier prediction ---
            clf_df = full_feature_df[self.features].fillna(0)
            pred = self.model.predict(clf_df)[0]
            proba = self.model.predict_proba(clf_df)[0]

            home_win_prob = float(proba[1])
            away_win_prob = float(proba[0])
            confidence = max(home_win_prob, away_win_prob)

            result = {
                "home_team": home_team,
                "away_team": away_team,
                "home_win_probability": round(home_win_prob, 4),
                "away_win_probability": round(away_win_prob, 4),
                "predicted_winner": home_team if pred == 1 else away_team,
                "confidence": round(confidence, 4),
                "model_accuracy": round(self.metrics["accuracy"], 4),
                "model_type": "GradientBoostingClassifier",
                "features_used": len(self.features),
            }

            # --- Score prediction ---
            if self.score_home_model and self.score_features:
                try:
                    score_df = full_feature_df.reindex(columns=self.score_features, fill_value=0).fillna(0)
                    home_score = float(self.score_home_model.predict(score_df)[0])
                    away_score = float(self.score_away_model.predict(score_df)[0])
                    result["predicted_home_score"] = round(home_score)
                    result["predicted_away_score"] = round(away_score)
                    result["predicted_total"] = round(home_score + away_score)
                    result["predicted_margin"] = round(home_score - away_score, 1)
                except Exception as e:
                    logger.warning(f"Score prediction failed: {e}")

            return result
        except Exception as e:
            logger.error(f"Prediction failed for {home_team} vs {away_team}: {e}")
            return None

    def predict_games(self, games: list[dict]) -> list[dict]:
        """
        Predict outcomes for multiple games.
        Each game dict should have 'teams' with two team names,
        where teams[0] is typically home (favorite) and teams[1] is away.
        
        Note: Polymarket doesn't always list home team first.
        We try to figure out home/away from title order.
        """
        predictions = []
        for game in games:
            teams = game.get("teams", [])
            title = game.get("title", "")

            if len(teams) < 2:
                predictions.append(None)
                continue

            # Parse home/away from title "Team A vs. Team B"
            # In NBA, the format is typically "Away vs. Home" or we just use the two team names
            parts = title.split(" vs. ") if " vs. " in title else title.split(" vs ")
            if len(parts) == 2:
                away_name = parts[0].strip()
                home_name = parts[1].strip()
            else:
                home_name = teams[0]["name"]
                away_name = teams[1]["name"]

            prediction = self.predict_game(home_name, away_name)
            if prediction:
                prediction["game_id"] = game.get("id", "")
            predictions.append(prediction)

        return predictions

    def get_model_info(self) -> dict:
        """Return model metadata for the analysis page."""
        return {
            "model_type": "GradientBoostingClassifier",
            "features": self.features or [],
            "dropped_features": self.dropped if hasattr(self, "dropped") else [],
            "metrics": {
                "accuracy": 0.656,
                "temporal_accuracy": 0.648,
                "auc": 0.692,
                "f1": 0.714,
                "total_games": self.metrics.get("total_games", 0) if self.metrics else 0,
            },
            "available_charts": [
                {"id": "data_overview", "file": "01_data_overview.png", "title": "Data Overview"},
                {"id": "confusion_matrix", "file": "02_confusion_matrix.png", "title": "Confusion Matrix"},
                {"id": "feature_importance", "file": "03_feature_importance.png", "title": "Feature Importance"},
                {"id": "correlation_heatmap", "file": "04_correlation_heatmap.png", "title": "Correlation Heatmap"},
                {"id": "target_correlation", "file": "05_target_correlation.png", "title": "Target Correlation"},
                {"id": "ablation_study", "file": "06_ablation_study.png", "title": "Feature Ablation Study"},
                {"id": "season_accuracy", "file": "07_season_accuracy.png", "title": "Accuracy by Season"},
                {"id": "calibration", "file": "08_calibration.png", "title": "Calibration Curve"},
                {"id": "algorithm_comparison", "file": "09_algorithm_comparison.png", "title": "Algorithm Comparison"},
                {"id": "roc_curve", "file": "10_roc_curve.png", "title": "ROC Curve"},
                {"id": "dashboard", "file": "11_dashboard.png", "title": "Full Dashboard"},
            ],
        }
