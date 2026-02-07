"""
refresh_data.py — Scrape latest NBA data, rebuild features, retrain model.
─────────────────────────────────────────────────────────────────────────
Run from backend/:
    python refresh_data.py           # Scrape missing games + rebuild + retrain
    python refresh_data.py --status  # Just show what's missing
    python refresh_data.py --retrain # Only retrain (no scraping)
    python refresh_data.py --nuke    # Delete 2025-26 data and rescrape from scratch
"""

import os
import sys
import time
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

BACKEND = os.path.dirname(os.path.abspath(__file__))
PROC = os.path.join(BACKEND, "data", "processedData")
LOGS_PATH = os.path.join(PROC, "gameLogs.csv")
SCHED_PATH = os.path.join(PROC, "full_schedule.csv")
FINAL_PATH = os.path.join(PROC, "finalModelTraining.csv")

CURRENT_SEASON = 2025
SEASON_STR = "2025-26"


def check_status():
    """Print current data state and return count of missing games."""
    logs = pd.read_csv(LOGS_PATH)
    logs["GAME_DATE"] = pd.to_datetime(logs["GAME_DATE"], format="mixed")
    sched = pd.read_csv(SCHED_PATH, dtype={"GAME_ID": str})
    sched["GAME_DATE"] = pd.to_datetime(sched["GAME_DATE"], format="mixed")

    curr_logs = logs[logs["SEASON"] == SEASON_STR]
    curr_sched = sched[sched["SEASON"] == SEASON_STR]

    logged_ids = set(curr_logs["GAME_ID"].astype(str).str.zfill(10))
    past_sched = curr_sched[curr_sched["GAME_DATE"] < datetime.now()]
    past_ids = set(past_sched["GAME_ID"].astype(str).str.zfill(10))
    missing = past_ids - logged_ids

    print("=" * 50)
    print("CURRENT DATA STATE")
    print("=" * 50)
    print(f"Total gameLogs: {len(logs)} rows")
    print(f"2025-26 gameLogs: {len(curr_logs)} rows ({curr_logs['GAME_ID'].nunique()} games)")
    print(f"2025-26 latest: {curr_logs['GAME_DATE'].max()}")
    print(f"2025-26 schedule: {len(curr_sched)} entries (up to {curr_sched['GAME_DATE'].max()})")
    print(f"Missing games (played but not scraped): {len(missing)}")
    print("=" * 50)
    return missing


def update_schedule():
    """Scrape the latest schedule and merge into full_schedule.csv."""
    from data.scrapeRawData import getSeasonScheduleFrame

    print("\n[1/4] Scraping 2025-26 schedule from NBA API...")
    new_sched = getSeasonScheduleFrame(CURRENT_SEASON)

    if new_sched.empty:
        print("FAILED to get schedule. Aborting.")
        return False

    new_sched["GAME_ID"] = new_sched["GAME_ID"].astype(str).str.zfill(10)

    # Merge with existing
    existing = pd.read_csv(SCHED_PATH, dtype={"GAME_ID": str})
    existing["GAME_ID"] = existing["GAME_ID"].astype(str).str.zfill(10)

    # Remove old 2025-26 entries, replace with fresh
    existing = existing[existing["SEASON"] != SEASON_STR]
    combined = pd.concat([existing, new_sched], ignore_index=True)
    combined.drop_duplicates(subset=["GAME_ID"], inplace=True)
    combined.to_csv(SCHED_PATH, index=False)

    print(f"   Schedule updated: {len(new_sched)} games for 2025-26")
    return True


def scrape_missing_games():
    """Scrape game logs for all games in schedule but not in gameLogs."""
    from data.scrapeRawData import getSingleGameMetrics

    sched = pd.read_csv(SCHED_PATH, dtype={"GAME_ID": str})
    sched["GAME_DATE"] = pd.to_datetime(sched["GAME_DATE"], format="mixed")
    sched["GAME_ID"] = sched["GAME_ID"].astype(str).str.zfill(10)

    logs = pd.read_csv(LOGS_PATH, dtype={"GAME_ID": str})
    logs["GAME_ID"] = logs["GAME_ID"].astype(str).str.zfill(10)
    logged_ids = set(logs["GAME_ID"])

    # Only scrape past games that aren't in gameLogs
    curr_sched = sched[sched["SEASON"] == SEASON_STR].copy()
    curr_sched = curr_sched[curr_sched["GAME_DATE"] < datetime.now()]
    to_scrape = curr_sched[~curr_sched["GAME_ID"].isin(logged_ids)]

    to_scrape = to_scrape.sort_values("GAME_DATE")

    print(f"\n[2/4] Scraping {len(to_scrape)} missing game logs...")

    if to_scrape.empty:
        print("   No missing games. Already up to date.")
        return

    new_logs = pd.DataFrame()
    total = len(to_scrape)

    for i, (_, row) in enumerate(to_scrape.iterrows(), 1):
        gid = row["GAME_ID"]
        date_str = pd.to_datetime(row["GAME_DATE"]).strftime("%Y-%m-%d")
        home_nick = row.get("HOME_TEAM_NICKNAME", "?")
        away_nick = row.get("AWAY_TEAM_NICKNAME", "?")

        print(f"   [{i}/{total}] {date_str} {away_nick} @ {home_nick} (ID: {gid})")

        try:
            d = getSingleGameMetrics(
                gid,
                row["HOME_TEAM_ID"],
                row["AWAY_TEAM_ID"],
                away_nick,
                row["SEASON"],
                row["GAME_DATE"],
            )
            if d is not None and not d.empty:
                d["GAME_ID"] = d["GAME_ID"].astype(str).str.zfill(10)
                d["TEAM_ID"] = d["TEAM_ID"].astype(int)
                new_logs = pd.concat([new_logs, d], ignore_index=True)
            else:
                print(f"      No data returned")
        except Exception as e:
            print(f"      ERROR: {e}")

        time.sleep(2.0)

    if new_logs.empty:
        print("   No new logs scraped.")
        return

    print(f"   Scraped {len(new_logs)} new log rows ({new_logs['GAME_ID'].nunique()} games)")

    # Append to gameLogs
    all_logs = pd.concat([logs, new_logs], ignore_index=True)
    all_logs.drop_duplicates(subset=["GAME_ID", "TEAM_ID"], inplace=True)
    all_logs.to_csv(LOGS_PATH, index=False)
    print(f"   gameLogs.csv updated: {len(all_logs)} total rows")


def rebuild_features():
    """Rebuild finalModelTraining.csv from gameLogs."""
    from data.features import getGameLogFeatureSet

    print("\n[3/4] Rebuilding features...")
    logs = pd.read_csv(LOGS_PATH)
    final = getGameLogFeatureSet(logs)
    final.to_csv(FINAL_PATH, index=False)
    print(f"   finalModelTraining.csv: {len(final)} rows")


def retrain():
    """Retrain the model."""
    print("\n[4/4] Retraining model...")
    os.makedirs(os.path.join(BACKEND, "models"), exist_ok=True)
    from model.RandomForestClassifier import trainModel
    trainModel()
    print("   Model saved to models/nba_model.pkl")


def nuke_and_rescrape():
    """Delete all 2025-26 data and rescrape from scratch."""
    print("\nNUKING 2025-26 data...")

    # Remove from gameLogs
    logs = pd.read_csv(LOGS_PATH)
    before = len(logs)
    logs = logs[logs["SEASON"] != SEASON_STR]
    logs.to_csv(LOGS_PATH, index=False)
    print(f"   gameLogs: removed {before - len(logs)} rows (kept {len(logs)})")

    # Remove from full_schedule
    sched = pd.read_csv(SCHED_PATH, dtype={"GAME_ID": str})
    before = len(sched)
    sched = sched[sched["SEASON"] != SEASON_STR]
    sched.to_csv(SCHED_PATH, index=False)
    print(f"   full_schedule: removed {before - len(sched)} rows (kept {len(sched)})")

    print("   2025-26 data wiped. Now running full refresh...\n")


if __name__ == "__main__":
    if "--status" in sys.argv:
        check_status()
        sys.exit(0)

    if "--retrain" in sys.argv:
        retrain()
        sys.exit(0)

    if "--nuke" in sys.argv:
        nuke_and_rescrape()

    # Step 1: Update schedule
    if not update_schedule():
        sys.exit(1)

    # Step 2: Scrape missing game logs
    scrape_missing_games()

    # Step 3: Rebuild features
    rebuild_features()

    # Step 4: Retrain
    retrain()

    print("\n" + "=" * 50)
    print("ALL DONE!")
    print("=" * 50)
    check_status()
