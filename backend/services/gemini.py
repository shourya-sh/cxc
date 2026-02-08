"""
AI Chat Service — GPT-powered NBA betting analyst
──────────────────────────────────────────────────
Takes user questions, loads live Polymarket + model data,
and uses Azure OpenAI to generate intelligent responses.
"""

import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from loguru import logger
from openai import AzureOpenAI

from services.polymarket import PolymarketService
from services.predictions import PredictionService

load_dotenv()

AZURE_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

SYSTEM_PROMPT = """You are CXC, an elite NBA betting intelligence analyst. Smart, concise, data-driven. You combine Polymarket odds with a custom ML model to give sharp betting advice.

## DATA SOURCES
1. **Polymarket** — real-money prediction market, odds = crowd consensus.
2. **CXC ML Model** — Gradient Boosted Trees, **10,231 games**, **9 seasons** (2017-2026), **12 optimized features**, **65.6% accuracy**, **76% on high-confidence picks**.
3. **Score Model** — Stacking ensemble (GBR + Random Forest), predicts final scores with **~10 pt MAE per team**.

## MODEL SIGNALS (never write raw variable names — translate to plain English)
- Home/away win rates → "their home/road record"
- Rest days → "rest advantage" or "back-to-back fatigue"
- Rolling 5-game scoring margin → "recent margin trend"
- Rolling FG% & offensive efficiency → "shooting & offensive form"
- H2H average margin → "head-to-head history"
- Home advantage differential → "home court edge"

## RESPONSE RULES
- **2-3 paragraphs max.** Be punchy. No fluff.
- **Lead with the numbers.** Open with the key stats, then add 1-2 sentences of context.
- Use **bold** for team names, percentages, scores, and key takeaways.
- Include actual numbers constantly: probabilities, confidence %, predicted scores, margins, volume.
- When comparing: use bullet points with stats, not long paragraphs.
- When model & market disagree → call it an **edge**, explain the gap in 1-2 sentences.
- Safest bet = model + market agree + confidence >65%. Say that clearly.
- Sound confident and sharp. Phrases: "the data is clear", "classic rest advantage play", "this is where the value is".
- NEVER use raw feature names like HOME_LAST_GAME or AWAY_ROLLING. Always plain English.
- TODAY/TONIGHT = games on the current date in the data. Check dates carefully.
- If a team has multiple games, "tonight" = closest to now.
- Be honest about what the model can't see (injuries, trades, lineups)."""


class GeminiService:
    def __init__(self):
        self.polymarket = PolymarketService()
        self.predictor = PredictionService()
        self.client = None
        self._init_client()

    def _init_client(self):
        if not AZURE_KEY or not AZURE_ENDPOINT:
            logger.warning("No Azure OpenAI credentials found in .env")
            return
        try:
            self.client = AzureOpenAI(
                api_key=AZURE_KEY,
                azure_endpoint=AZURE_ENDPOINT,
                api_version="2024-12-01-preview",
            )
            logger.info(f"Azure OpenAI initialized (deployment: {AZURE_DEPLOYMENT})")
        except Exception as e:
            logger.error(f"Failed to initialize Azure OpenAI: {e}")

    async def _build_context(self) -> str:
        """Build a compact context string with live game data + predictions."""
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")

        try:
            games = await self.polymarket.get_nba_games()
            predictions = self.predictor.predict_games(games)

            today_lines = []
            future_lines = []
            edges = []

            for game, pred in zip(games, predictions):
                teams = game.get("teams", [])
                if len(teams) < 2:
                    continue
                t1, t2 = teams[0]["name"], teams[1]["name"]
                p1 = round(teams[0]["probability"] * 100)
                p2 = round(teams[1]["probability"] * 100)
                raw_date = game.get("game_date", "")
                vol = round(game.get("volume", 0))

                # Parse date for today/future grouping
                game_date_str = raw_date[:10] if raw_date else ""
                try:
                    game_dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                    nice_date = game_dt.strftime("%a %b %d, %I:%M %p ET")
                except Exception:
                    nice_date = raw_date[:16]

                is_today = game_date_str == today_str

                if pred:
                    mh = round(pred["home_win_probability"] * 100)
                    ma = round(pred["away_win_probability"] * 100)
                    conf = round(pred["confidence"] * 100)
                    winner = pred["predicted_winner"]
                    home = pred["home_team"]
                    away = pred["away_team"]
                    line = f"{away} @ {home} ({nice_date}) | Market: {t1} {p1}%, {t2} {p2}% | Model: {home} {mh}%, {away} {ma}% (conf {conf}%) | Vol: ${vol:,}"

                    # Add predicted scores if available
                    hs = pred.get("predicted_home_score")
                    as_ = pred.get("predicted_away_score")
                    if hs and as_:
                        line += f" | Score: {home} {hs} - {away} {as_} (total {hs+as_})"

                    poly_fav = t1 if teams[0]["probability"] > teams[1]["probability"] else t2
                    if poly_fav.lower() != winner.lower():
                        edges.append(f"EDGE: {away} @ {home} — Market favors {poly_fav} ({max(p1,p2)}%), model favors {winner}")
                        line += " *** EDGE ***"
                else:
                    line = f"{t1} vs {t2} ({nice_date}) | Market: {t1} {p1}%, {t2} {p2}% | No model pred | Vol: ${vol:,}"

                if is_today:
                    today_lines.append(line)
                else:
                    future_lines.append(line)

            sections = [f"CURRENT DATE/TIME: {now.strftime('%A, %B %d, %Y at %I:%M %p UTC')}"]

            if today_lines:
                sections.append(f"\nTONIGHT'S GAMES ({len(today_lines)}):\n" + "\n".join(today_lines))
            if future_lines:
                sections.append(f"\nUPCOMING GAMES ({len(future_lines)}):\n" + "\n".join(future_lines))
            if edges:
                sections.append("\nEDGES (model disagrees with market):\n" + "\n".join(edges))
            else:
                sections.append("\nNo edges — model agrees with market on all favorites.")

            sections.append("\nMODEL: GradientBoostingClassifier, 65.6% accuracy, 76% on high-confidence, 12 features, 10,231 training games.")

            return "\n".join(sections)

        except Exception as e:
            logger.error(f"Failed to build context: {e}")
            return "No live game data available right now."

    async def chat(self, message: str) -> str:
        """Process a user message and return AI response."""
        if not self.client:
            return "AI assistant is not configured. Please add Azure OpenAI credentials to the .env file."

        try:
            context = await self._build_context()

            response = self.client.chat.completions.create(
                model=AZURE_DEPLOYMENT,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"{context}\n\nUSER QUESTION: {message}"},
                ],
                temperature=0.65,
                max_tokens=700,
            )

            result = response.choices[0].message.content
            logger.info(f"Chat OK ({response.usage.total_tokens} tokens)")
            return result

        except Exception as e:
            logger.error(f"Azure OpenAI chat error: {e}")
            return "Sorry, I ran into an error processing your question. Try again in a moment."
