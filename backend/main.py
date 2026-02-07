"""
CXC Backend — Sports Betting Intelligence Platform
Main FastAPI application entry point.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from api.routes import events, predictions, prompts
from services.scheduler import start_scheduler, stop_scheduler
from database.db import init_db

load_dotenv()

# ── Lifespan ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting CXC Backend...")
    await init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("🛑 CXC Backend shutting down.")


# ── App ─────────────────────────────────────────────────
app = FastAPI(
    title="CXC — Sports Betting Intelligence",
    description="AI-powered sports prediction & Polymarket integration",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS (allow Next.js frontend) ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ──────────────────────────────────────────────
app.include_router(events.router,      prefix="/api/events",      tags=["Events"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(prompts.router,     prefix="/api/prompts",     tags=["Prompts"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
