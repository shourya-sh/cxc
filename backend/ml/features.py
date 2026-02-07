"""
Feature Engineering for Sports Prediction Models
─────────────────────────────────────────────────
Defines the feature sets for each league's prediction model.
You'll fill in real feature extraction logic once you have
your training data on Google Cloud GPU.
"""

import numpy as np
import pandas as pd
from typing import Optional


# ── Feature columns per league ────────────────────────────
LEAGUE_FEATURES = {
    "nba": [
        "home_win_pct", "away_win_pct",
        "home_avg_pts", "away_avg_pts",
        "home_avg_reb", "away_avg_reb",
        "home_avg_ast", "away_avg_ast",
        "home_avg_fg_pct", "away_avg_fg_pct",
        "home_avg_3pt_pct", "away_avg_3pt_pct",
        "home_avg_ft_pct", "away_avg_ft_pct",
        "home_streak", "away_streak",           # +/- win streak
        "home_rest_days", "away_rest_days",
        "home_injuries_impact", "away_injuries_impact",  # 0-1 score
        "home_elo", "away_elo",
        "head_to_head_home_wins", "head_to_head_total",
        "home_pace", "away_pace",               # possessions/game
        "home_def_rating", "away_def_rating",
        "home_off_rating", "away_off_rating",
    ],
    "nfl": [
        "home_win_pct", "away_win_pct",
        "home_avg_pts_scored", "away_avg_pts_scored",
        "home_avg_pts_allowed", "away_avg_pts_allowed",
        "home_avg_yards", "away_avg_yards",
        "home_avg_pass_yards", "away_avg_pass_yards",
        "home_avg_rush_yards", "away_avg_rush_yards",
        "home_turnover_diff", "away_turnover_diff",
        "home_sacks", "away_sacks",
        "home_third_down_pct", "away_third_down_pct",
        "home_red_zone_pct", "away_red_zone_pct",
        "home_elo", "away_elo",
        "home_streak", "away_streak",
        "home_injuries_impact", "away_injuries_impact",
        "spread_line", "over_under_line",
    ],
    "mlb": [
        "home_win_pct", "away_win_pct",
        "home_avg_runs", "away_avg_runs",
        "home_avg_hits", "away_avg_hits",
        "home_team_era", "away_team_era",
        "home_starter_era", "away_starter_era",
        "home_starter_whip", "away_starter_whip",
        "home_bullpen_era", "away_bullpen_era",
        "home_avg_obp", "away_avg_obp",
        "home_avg_slg", "away_avg_slg",
        "home_fielding_pct", "away_fielding_pct",
        "home_streak", "away_streak",
        "home_elo", "away_elo",
        "home_rest_days", "away_rest_days",
    ],
    "nhl": [
        "home_win_pct", "away_win_pct",
        "home_avg_goals", "away_avg_goals",
        "home_avg_goals_against", "away_avg_goals_against",
        "home_pp_pct", "away_pp_pct",           # power play %
        "home_pk_pct", "away_pk_pct",           # penalty kill %
        "home_avg_shots", "away_avg_shots",
        "home_save_pct", "away_save_pct",
        "home_faceoff_pct", "away_faceoff_pct",
        "home_streak", "away_streak",
        "home_elo", "away_elo",
        "home_goalie_gaa", "away_goalie_gaa",   # goals against avg
        "home_injuries_impact", "away_injuries_impact",
    ],
    "soccer": [
        "home_win_pct", "away_win_pct",
        "home_avg_goals", "away_avg_goals",
        "home_avg_goals_conceded", "away_avg_goals_conceded",
        "home_avg_possession", "away_avg_possession",
        "home_avg_shots_on_target", "away_avg_shots_on_target",
        "home_avg_xg", "away_avg_xg",           # expected goals
        "home_avg_xga", "away_avg_xga",
        "home_clean_sheet_pct", "away_clean_sheet_pct",
        "home_streak", "away_streak",
        "home_elo", "away_elo",
        "home_injuries_impact", "away_injuries_impact",
        "home_form_last5", "away_form_last5",    # points from last 5
    ],
}


def get_feature_names(league: str) -> list[str]:
    """Get feature column names for a league."""
    return LEAGUE_FEATURES.get(league.lower(), LEAGUE_FEATURES["nba"])


def extract_features(
    league: str,
    home_team: str,
    away_team: str,
    raw_stats: Optional[dict] = None,
) -> np.ndarray:
    """
    Extract feature vector for a matchup.

    TODO: Replace this placeholder with real data fetching
    from your sports data provider when you have the training
    pipeline set up on Google Cloud GPU.
    """
    feature_names = get_feature_names(league)
    n_features = len(feature_names)

    if raw_stats:
        # If raw stats provided, build feature vector from them
        features = []
        for fname in feature_names:
            features.append(raw_stats.get(fname, 0.0))
        return np.array(features).reshape(1, -1)

    # ── Placeholder: random features for skeleton testing ──
    # This will be replaced with real feature extraction
    rng = np.random.default_rng(hash(f"{home_team}{away_team}") % 2**32)
    features = rng.random(n_features)
    return features.reshape(1, -1)


def generate_synthetic_training_data(
    league: str,
    n_samples: int = 5000,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Generate synthetic training data for initial model testing.

    TODO: Replace with real historical data loading from your
    Google Cloud storage / BigQuery / CSV files.

    Returns:
        X: DataFrame with feature columns
        y: Series with binary labels (1 = home win, 0 = away win)
    """
    feature_names = get_feature_names(league)
    rng = np.random.default_rng(seed)

    # Generate random features
    X = pd.DataFrame(
        rng.random((n_samples, len(feature_names))),
        columns=feature_names,
    )

    # Create somewhat realistic labels based on features
    # (home team with higher stats = more likely to win)
    home_strength = X[[c for c in feature_names if c.startswith("home_")]].mean(axis=1)
    away_strength = X[[c for c in feature_names if c.startswith("away_")]].mean(axis=1)
    prob_home_win = 1 / (1 + np.exp(-(home_strength - away_strength) * 5))
    y = pd.Series((rng.random(n_samples) < prob_home_win).astype(int), name="home_win")

    return X, y
