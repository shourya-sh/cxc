"""
Model Training Pipeline
────────────────────────
Trains per-league models using scikit-learn (+ XGBoost).
Run this script to train all models, or import and call
train_league_model() for a specific league.

Usage:
    python -m ml.train              # Train all leagues
    python -m ml.train --league nba # Train NBA only
"""

import os
import argparse
import joblib
import json
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    VotingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
    confusion_matrix,
)
from xgboost import XGBClassifier
from loguru import logger

from ml.features import (
    get_feature_names,
    generate_synthetic_training_data,
    LEAGUE_FEATURES,
)

# ── Paths ────────────────────────────────────────────────
MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "models"))
DATA_DIR = os.environ.get("TRAINING_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)


def load_training_data(league: str) -> tuple[pd.DataFrame, pd.Series]:
    """
    Load training data for a league.

    Priority:
    1. Real CSV data from DATA_DIR/{league}_training.csv
    2. Synthetic data (fallback for skeleton testing)

    TODO: Replace with your actual data loading from Google Cloud.
    """
    csv_path = os.path.join(DATA_DIR, f"{league.lower()}_training.csv")

    if os.path.exists(csv_path):
        logger.info(f"Loading real training data from {csv_path}")
        df = pd.read_csv(csv_path)
        feature_cols = get_feature_names(league)
        # Filter to only available columns
        available = [c for c in feature_cols if c in df.columns]
        X = df[available]
        y = df["home_win"] if "home_win" in df.columns else df.iloc[:, -1]
        return X, y

    logger.warning(f"No real data for {league}, using synthetic data")
    return generate_synthetic_training_data(league)


def build_model_pipeline(model_type: str = "ensemble") -> Pipeline:
    """
    Build a scikit-learn pipeline with preprocessing + model.

    Model types:
        - 'logistic'   : Logistic Regression
        - 'rf'         : Random Forest
        - 'gb'         : Gradient Boosting
        - 'xgb'        : XGBoost
        - 'ensemble'   : Voting ensemble of all above
    """
    scaler = StandardScaler()

    if model_type == "logistic":
        model = LogisticRegression(max_iter=1000, C=1.0, random_state=42)
    elif model_type == "rf":
        model = RandomForestClassifier(
            n_estimators=200, max_depth=10, min_samples_split=5, random_state=42
        )
    elif model_type == "gb":
        model = GradientBoostingClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42
        )
    elif model_type == "xgb":
        model = XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            use_label_encoder=False, eval_metric="logloss", random_state=42,
        )
    elif model_type == "ensemble":
        model = VotingClassifier(
            estimators=[
                ("lr", LogisticRegression(max_iter=1000, C=1.0, random_state=42)),
                ("rf", RandomForestClassifier(n_estimators=150, max_depth=8, random_state=42)),
                ("xgb", XGBClassifier(
                    n_estimators=150, max_depth=5, learning_rate=0.1,
                    use_label_encoder=False, eval_metric="logloss", random_state=42,
                )),
            ],
            voting="soft",
        )
    else:
        raise ValueError(f"Unknown model type: {model_type}")

    return Pipeline([
        ("scaler", scaler),
        ("model", model),
    ])


def train_league_model(
    league: str,
    model_type: str = "ensemble",
    test_size: float = 0.2,
    do_cv: bool = True,
) -> dict:
    """
    Train a model for a specific league.

    Returns metrics dict with accuracy, precision, recall, F1, AUC.
    Saves the trained model to MODEL_DIR.
    """
    logger.info(f"{'='*60}")
    logger.info(f"Training {model_type} model for {league.upper()}")
    logger.info(f"{'='*60}")

    # ── Load data ─────────────────────────────────────────
    X, y = load_training_data(league)
    logger.info(f"Dataset: {X.shape[0]} samples, {X.shape[1]} features")

    # ── Train/test split ──────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )

    # ── Build & train pipeline ────────────────────────────
    pipeline = build_model_pipeline(model_type)
    pipeline.fit(X_train, y_train)

    # ── Evaluate ──────────────────────────────────────────
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1] if hasattr(pipeline, "predict_proba") else None

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
    }

    if y_proba is not None:
        metrics["auc_roc"] = round(roc_auc_score(y_test, y_proba), 4)

    # ── Cross-validation ──────────────────────────────────
    if do_cv:
        cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring="accuracy")
        metrics["cv_accuracy_mean"] = round(cv_scores.mean(), 4)
        metrics["cv_accuracy_std"] = round(cv_scores.std(), 4)

    logger.info(f"Metrics: {json.dumps(metrics, indent=2)}")
    logger.info(f"\n{classification_report(y_test, y_pred)}")

    # ── Save model ────────────────────────────────────────
    model_path = os.path.join(MODEL_DIR, f"{league.lower()}_{model_type}.pkl")
    joblib.dump(pipeline, model_path)
    logger.info(f"Model saved to {model_path}")

    # ── Save metadata ─────────────────────────────────────
    metadata = {
        "league": league,
        "model_type": model_type,
        "features": list(X.columns) if isinstance(X, pd.DataFrame) else get_feature_names(league),
        "n_samples": X.shape[0],
        "n_features": X.shape[1],
        "metrics": metrics,
        "trained_at": datetime.utcnow().isoformat(),
    }
    meta_path = os.path.join(MODEL_DIR, f"{league.lower()}_{model_type}_meta.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return metrics


def train_all_models(model_type: str = "ensemble"):
    """Train models for all supported leagues."""
    results = {}
    for league in LEAGUE_FEATURES:
        try:
            metrics = train_league_model(league, model_type=model_type)
            results[league] = {"status": "success", "metrics": metrics}
        except Exception as e:
            logger.error(f"Failed to train {league}: {e}")
            results[league] = {"status": "error", "error": str(e)}
    return results


# ── CLI entry point ──────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train sports prediction models")
    parser.add_argument("--league", type=str, default=None, help="League to train (nba, nfl, mlb, nhl, soccer)")
    parser.add_argument("--model", type=str, default="ensemble", help="Model type (logistic, rf, gb, xgb, ensemble)")
    args = parser.parse_args()

    if args.league:
        train_league_model(args.league, model_type=args.model)
    else:
        train_all_models(model_type=args.model)
