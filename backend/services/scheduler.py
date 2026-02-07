"""
Background scheduler for periodic tasks:
- Refresh live game data
- Update Polymarket odds
- Retrain models on schedule
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

scheduler = AsyncIOScheduler()


async def refresh_live_games():
    """Periodically refresh live game data."""
    logger.debug("Refreshing live game data...")
    # TODO: Call sports data API and cache results


async def refresh_polymarket_odds():
    """Periodically refresh Polymarket odds for tracked markets."""
    logger.debug("Refreshing Polymarket odds...")
    # TODO: Fetch latest odds for bookmarked/tracked markets


def start_scheduler():
    """Start the background scheduler."""
    scheduler.add_job(refresh_live_games, "interval", seconds=30, id="refresh_games")
    scheduler.add_job(refresh_polymarket_odds, "interval", seconds=60, id="refresh_odds")
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    """Stop the background scheduler."""
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
