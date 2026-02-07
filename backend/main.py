"""
CXC Backend — Sports Betting Intelligence Platform
FastAPI app: serves Polymarket data + ML predictions.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import events, predictions, chat

app = FastAPI(
    title="CXC — Sports Betting Intelligence",
    version="0.2.0",
)

# CORS (allow Next.js frontend)
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

# Routes
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

# Serve notebook chart images as static files
CHARTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notebooks")
if os.path.isdir(CHARTS_DIR):
    app.mount("/api/charts", StaticFiles(directory=CHARTS_DIR), name="charts")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.2.0"}
