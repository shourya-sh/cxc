"""
NBA Win/Loss Model Comparison — Train & compare multiple classifiers
────────────────────────────────────────────────────────────────────
Same data, same 12 optimized features, same train/test split.
Models: GradientBoosting (baseline), RandomForest, AdaBoost,
        sklearn MLPClassifier, PyTorch custom MLP with BatchNorm + Dropout.
Run: python model/model_comparison.py
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, AdaBoostClassifier
from sklearn.neural_network import MLPClassifier
import warnings

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BACKEND_DIR, "data", "processedData", "finalModelTraining.csv")

FEATURE_COLS = [
    "HOME_LAST_GAME_HOME_WIN_PCTG",
    "HOME_LAST_GAME_AWAY_WIN_PCTG",
    "HOME_NUM_REST_DAYS",
    "HOME_LAST_GAME_ROLLING_SCORING_MARGIN",
    "HOME_LAST_GAME_ROLLING_FG_PCT",
    "AWAY_LAST_GAME_AWAY_WIN_PCTG",
    "AWAY_NUM_REST_DAYS",
    "AWAY_LAST_GAME_ROLLING_OE",
    "AWAY_LAST_GAME_ROLLING_SCORING_MARGIN",
    "H2H_HOME_AVG_MARGIN",
    "HOME_ADVANTAGE",
    "FG_PCT_DIFF",
]


def load_data():
    raw = pd.read_csv(DATA_PATH).fillna(0)
    X = raw[FEATURE_COLS]
    y = raw["HOME_W"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    return X_train, X_test, y_train, y_test


def eval_model(name, y_true, y_pred, y_proba=None):
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    auc = roc_auc_score(y_true, y_proba, average="macro") if y_proba is not None else 0.0
    return {
        "name": name,
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "auc": auc,
    }


def run_gradient_boosting(X_train, X_test, y_train, y_test):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m = GradientBoostingClassifier(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.85,
            random_state=42,
        )
        m.fit(X_train, y_train)
    y_pred = m.predict(X_test)
    y_proba = m.predict_proba(X_test)[:, 1]
    return m, eval_model("GradientBoostingClassifier", y_test, y_pred, y_proba)


def run_random_forest(X_train, X_test, y_train, y_test):
    m = RandomForestClassifier(
        n_estimators=400,
        max_depth=10,
        min_samples_leaf=5,
        random_state=42,
    )
    m.fit(X_train, y_train)
    y_pred = m.predict(X_test)
    y_proba = m.predict_proba(X_test)[:, 1]
    return m, eval_model("RandomForestClassifier", y_test, y_pred, y_proba)


def run_adaboost(X_train, X_test, y_train, y_test):
    m = AdaBoostClassifier(
        n_estimators=200,
        learning_rate=0.8,
        algorithm="SAMME",
        random_state=42,
    )
    m.fit(X_train, y_train)
    y_pred = m.predict(X_test)
    y_proba = m.predict_proba(X_test)[:, 1]
    return m, eval_model("AdaBoostClassifier", y_test, y_pred, y_proba)


def run_sklearn_mlp(X_train, X_test, y_train, y_test, scaler):
    X_tr = scaler.transform(X_train)
    X_te = scaler.transform(X_test)
    m = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        solver="adam",
        alpha=0.001,
        batch_size=128,
        max_iter=150,
        early_stopping=True,
        random_state=42,
    )
    m.fit(X_tr, y_train)
    y_pred = m.predict(X_te)
    y_proba = m.predict_proba(X_te)[:, 1]
    return m, eval_model("sklearn MLPClassifier (128-64-32)", y_test, y_pred, y_proba)


def run_xgboost(X_train, X_test, y_train, y_test):
    try:
        import xgboost as xgb
    except ImportError:
        return None, None
    m = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )
    m.fit(X_train, y_train)
    y_pred = m.predict(X_test)
    y_proba = m.predict_proba(X_test)[:, 1]
    return m, eval_model("XGBoost", y_test, y_pred, y_proba)


def run_pytorch_mlp(X_train, X_test, y_train, y_test, scaler):
    try:
        import torch
        import torch.nn as nn
    except ImportError:
        print("  PyTorch not installed. Skipping PyTorch MLP.")
        return None, None

    X_tr = scaler.transform(X_train).astype(np.float32)
    X_te = scaler.transform(X_test).astype(np.float32)
    y_tr = np.array(y_train.values, dtype=np.int64)
    y_te = np.array(y_test.values, dtype=np.int64)

    n_features = X_tr.shape[1]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    class NBAMLP(nn.Module):
        def __init__(self, input_dim=12, hidden=[64, 32, 16]):
            super().__init__()
            layers = []
            prev = input_dim
            for h in hidden:
                layers += [
                    nn.Linear(prev, h),
                    nn.BatchNorm1d(h),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                ]
                prev = h
            layers += [nn.Linear(prev, 2)]
            self.net = nn.Sequential(*layers)

        def forward(self, x):
            return self.net(x)

    model = NBAMLP(input_dim=n_features, hidden=[128, 64, 32, 16]).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    X_tr_t = torch.from_numpy(X_tr).to(device)
    y_tr_t = torch.from_numpy(y_tr).to(device)

    model.train()
    for epoch in range(80):
        opt.zero_grad()
        out = model(X_tr_t)
        loss = criterion(out, y_tr_t)
        loss.backward()
        opt.step()

    model.eval()
    with torch.no_grad():
        X_te_t = torch.from_numpy(X_te).to(device)
        logits = model(X_te_t)
        probs = torch.softmax(logits, dim=1)
        y_proba = probs[:, 1].cpu().numpy()
        y_pred = (y_proba >= 0.5).astype(int)

    return model, eval_model("PyTorch MLP (128-64-32-16, BatchNorm, Dropout)", y_test, y_pred, y_proba)


def main():
    print("Loading data...")
    X_train, X_test, y_train, y_test = load_data()
    print(f"Train: {len(X_train):,} | Test: {len(X_test):,} | Features: {len(FEATURE_COLS)}\n")

    scaler = StandardScaler()
    scaler.fit(X_train)

    results = []

    # 1. GradientBoosting (baseline)
    print("Training GradientBoostingClassifier...")
    _, r = run_gradient_boosting(X_train, X_test, y_train, y_test)
    results.append(r)

    # 2. RandomForest
    print("Training RandomForestClassifier...")
    _, r = run_random_forest(X_train, X_test, y_train, y_test)
    results.append(r)

    # 3. AdaBoost
    print("Training AdaBoostClassifier...")
    _, r = run_adaboost(X_train, X_test, y_train, y_test)
    results.append(r)

    # 4. XGBoost (optional)
    print("Training XGBoost...")
    _, r = run_xgboost(X_train, X_test, y_train, y_test)
    if r:
        results.append(r)

    # 5. sklearn MLP
    print("Training sklearn MLPClassifier...")
    _, r = run_sklearn_mlp(X_train, X_test, y_train, y_test, scaler)
    results.append(r)

    # 6. PyTorch MLP
    print("Training PyTorch MLP...")
    _, r = run_pytorch_mlp(X_train, X_test, y_train, y_test, scaler)
    if r:
        results.append(r)

    # Summary
    print("\n" + "=" * 70)
    print("  MODEL COMPARISON — NBA Win/Loss Prediction (12 features)")
    print("=" * 70)
    for r in sorted(results, key=lambda x: x["accuracy"], reverse=True):
        print(f"  {r['name']}")
        print(f"    Accuracy:  {r['accuracy']:.4f} ({r['accuracy']*100:.2f}%)")
        print(f"    F1:       {r['f1']:.4f}")
        print(f"    AUC:      {r['auc']:.4f}")
        print()
    print("=" * 70)

    best = max(results, key=lambda x: x["accuracy"])
    print(f"  Best: {best['name']} @ {best['accuracy']:.4f} accuracy\n")


if __name__ == "__main__":
    main()
