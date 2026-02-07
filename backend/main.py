"""
CXC Backend — Sports Betting Intelligence Platform
Minimal FastAPI app: serves Polymarket sports event data.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import events

app = FastAPI(
    title="CXC — Sports Betting Intelligence",
    version="0.1.0",
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
