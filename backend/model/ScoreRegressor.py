"""
NBA Score Prediction - Stacking Ensemble Regressor
Predicts HOME_PTS and AWAY_PTS for NBA games.
Uses a StackingRegressor (GBR + RandomForest -> Ridge meta-learner)
trained on 27 engineered features from 10,231 games across 9 seasons.
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import (
    GradientBoostingRegressor,
    RandomForestRegressor,
    StackingRegressor,
)
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BACKEND_DIR, "data", "processedData", "scoreModelTraining.csv")
MODELS_DIR = os.path.join(BACKEND_DIR, "model")
MODEL_PATH = os.path.join(MODELS_DIR, "nba_score_model.pkl")

# 27 features - expanded from the classifier's 12 to capture more scoring signal
FEATURE_COLS = [
    # Home team
    'HOME_LAST_GAME_HOME_WIN_PCTG', 'HOME_LAST_GAME_AWAY_WIN_PCTG',
    'HOME_LAST_GAME_TOTAL_WIN_PCTG',
    'HOME_NUM_REST_DAYS', 'HOME_IS_BACK_TO_BACK',
    'HOME_LAST_GAME_ROLLING_SCORING_MARGIN',
    'HOME_LAST_GAME_ROLLING_FG_PCT', 'HOME_LAST_GAME_ROLLING_OE',
    'HOME_LAST_GAME_LAST_3_WINS',
    # Away team
    'AWAY_LAST_GAME_AWAY_WIN_PCTG', 'AWAY_LAST_GAME_HOME_WIN_PCTG',
    'AWAY_LAST_GAME_TOTAL_WIN_PCTG',
    'AWAY_NUM_REST_DAYS', 'AWAY_IS_BACK_TO_BACK',
    'AWAY_LAST_GAME_ROLLING_OE',
    'AWAY_LAST_GAME_ROLLING_SCORING_MARGIN',
    'AWAY_LAST_GAME_ROLLING_FG_PCT', 'AWAY_LAST_GAME_LAST_3_WINS',
    # Head-to-head & diffs
    'H2H_HOME_AVG_MARGIN', 'H2H_HOME_WIN_PCT',
    'HOME_ADVANTAGE', 'FG_PCT_DIFF', 'OE_DIFF',
    'SCORING_MARGIN_DIFF', 'WIN_PCTG_DIFF', 'FORM_DIFF', 'REST_DIFF',
]


def _make_stacking_model():
    """Build a fresh stacking ensemble: GBR + RF -> Ridge."""
    estimators = [
        ('gbr', GradientBoostingRegressor(
            n_estimators=400, learning_rate=0.03,
            max_depth=4, subsample=0.85, random_state=42,
        )),
        ('rf', RandomForestRegressor(
            n_estimators=300, max_depth=8,
            min_samples_leaf=5, random_state=42,
        )),
    ]
    return StackingRegressor(estimators=estimators, final_estimator=Ridge(), cv=5)


def trainModel():
    """Train two stacking regressors: one for home score, one for away score."""
    data = pd.read_csv(DATA_PATH).fillna(0)

    X = data[FEATURE_COLS]
    y_home = data['HOME_PTS']
    y_away = data['AWAY_PTS']

    X_train, X_test, yh_train, yh_test, ya_train, ya_test = train_test_split(
        X, y_home, y_away, test_size=0.2, random_state=42
    )

    print(f"Train: {len(X_train):,}  |  Test: {len(X_test):,}")
    print(f"Features: {len(FEATURE_COLS)}")

    # -- HOME score --
    print("\n-- Training HOME score stacking ensemble --")
    home_model = _make_stacking_model()
    home_model.fit(X_train, yh_train)
    yh_pred = home_model.predict(X_test)
    home_mae = mean_absolute_error(yh_test, yh_pred)
    home_rmse = np.sqrt(mean_squared_error(yh_test, yh_pred))
    home_r2 = r2_score(yh_test, yh_pred)
    print(f"  MAE:  {home_mae:.2f} pts")
    print(f"  RMSE: {home_rmse:.2f}")
    print(f"  R2:   {home_r2:.4f}")

    # -- AWAY score --
    print("\n-- Training AWAY score stacking ensemble --")
    away_model = _make_stacking_model()
    away_model.fit(X_train, ya_train)
    ya_pred = away_model.predict(X_test)
    away_mae = mean_absolute_error(ya_test, ya_pred)
    away_rmse = np.sqrt(mean_squared_error(ya_test, ya_pred))
    away_r2 = r2_score(ya_test, ya_pred)
    print(f"  MAE:  {away_mae:.2f} pts")
    print(f"  RMSE: {away_rmse:.2f}")
    print(f"  R2:   {away_r2:.4f}")

    # -- Combined metrics --
    total_pred = yh_pred + ya_pred
    total_actual = yh_test.values + ya_test.values
    margin_pred = yh_pred - ya_pred
    margin_actual = yh_test.values - ya_test.values
    total_mae = mean_absolute_error(total_actual, total_pred)
    margin_mae = mean_absolute_error(margin_actual, margin_pred)

    correct = int(np.sum(np.sign(margin_pred) == np.sign(margin_actual)))
    winner_acc = correct / len(margin_actual)
    home_within_5 = float(np.mean(np.abs(yh_test.values - yh_pred) <= 5))
    away_within_5 = float(np.mean(np.abs(ya_test.values - ya_pred) <= 5))

    print(f"\n{'='*55}")
    print(f"  SCORE MODEL SUMMARY (Stacking Ensemble)")
    print(f"{'='*55}")
    print(f"  Home MAE:       {home_mae:.2f} pts")
    print(f"  Away MAE:       {away_mae:.2f} pts")
    print(f"  Total MAE:      {total_mae:.2f} pts")
    print(f"  Margin MAE:     {margin_mae:.2f} pts")
    print(f"  Winner acc:     {winner_acc:.1%}  ({correct}/{len(margin_actual)})")
    print(f"  Home within 5:  {home_within_5:.1%}")
    print(f"  Away within 5:  {away_within_5:.1%}")
    print(f"{'='*55}")

    # -- Save --
    bundle = {
        'home_model': home_model,
        'away_model': away_model,
        'features': FEATURE_COLS,
        'metrics': {
            'home_mae': round(home_mae, 2),
            'away_mae': round(away_mae, 2),
            'total_mae': round(total_mae, 2),
            'margin_mae': round(margin_mae, 2),
            'winner_accuracy': round(winner_acc, 4),
            'home_r2': round(home_r2, 4),
            'away_r2': round(away_r2, 4),
            'home_within_5': round(home_within_5, 4),
            'away_within_5': round(away_within_5, 4),
        },
    }
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(bundle, f)
    print(f"\nSaved to {MODEL_PATH}")
    return bundle


def predictScore(feature_df):
    """
    Predict home and away scores for game(s).
    feature_df: DataFrame with FEATURE_COLS columns (missing cols filled w/ 0).
    Returns list of dicts: [{home_score, away_score, total, margin}, ...]
    """
    with open(MODEL_PATH, 'rb') as f:
        bundle = pickle.load(f)

    home_model = bundle['home_model']
    away_model = bundle['away_model']
    features = bundle['features']

    X = feature_df.reindex(columns=features, fill_value=0).fillna(0)
    home_preds = home_model.predict(X)
    away_preds = away_model.predict(X)

    results = []
    for hp, ap in zip(home_preds, away_preds):
        results.append({
            'home_score': round(float(hp)),
            'away_score': round(float(ap)),
            'total': round(float(hp + ap)),
            'margin': round(float(hp - ap), 1),
        })
    return results


if __name__ == "__main__":
    bundle = trainModel()

    # -- Quick prediction test on last 5 games --
    print("\n-- Quick prediction test --")
    data = pd.read_csv(DATA_PATH).fillna(0)
    sample = data.tail(5)
    preds = predictScore(sample)
    for i, (_, row) in enumerate(sample.iterrows()):
        p = preds[i]
        actual_h, actual_a = int(row['HOME_PTS']), int(row['AWAY_PTS'])
        print(
            f"  Game {row['GAME_ID']:.0f}: "
            f"Predicted {p['home_score']}-{p['away_score']} "
            f"(actual {actual_h}-{actual_a})  "
            f"off by {abs(p['home_score']-actual_h)}H/{abs(p['away_score']-actual_a)}A"
        )
