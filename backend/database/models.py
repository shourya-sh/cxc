"""
Database models for caching and tracking.
"""

from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from database.db import Base


class TrackedMarket(Base):
    """Markets the user is tracking / bookmarked."""
    __tablename__ = "tracked_markets"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    league = Column(String, index=True)
    category = Column(String)
    outcomes = Column(JSON)
    last_odds = Column(JSON)
    volume = Column(Float, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class PredictionLog(Base):
    """Log of ML predictions for auditing / accuracy tracking."""
    __tablename__ = "prediction_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String, index=True)
    league = Column(String)
    home_team = Column(String)
    away_team = Column(String)
    home_win_prob = Column(Float)
    away_win_prob = Column(Float)
    predicted_winner = Column(String)
    confidence = Column(Float)
    model_type = Column(String)
    actual_winner = Column(String, nullable=True)  # filled in after game ends
    was_correct = Column(Boolean, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class OddsSnapshot(Base):
    """Historical odds snapshots for charting."""
    __tablename__ = "odds_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    market_id = Column(String, index=True)
    outcomes = Column(JSON)  # {"Team A": 0.65, "Team B": 0.35}
    timestamp = Column(DateTime, server_default=func.now())
