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

SYSTEM_PROMPT = """You are CXC, an elite NBA betting intelligence analyst built for a data science hackathon. You're like a really smart friend who watches every game, knows all the stats, and gives you straight-up advice on who to bet on. You combine live betting market data with a custom machine learning model.

## YOUR DATA SOURCES

1. **Polymarket** — A real-money prediction market where thousands of bettors put actual money on outcomes. These odds reflect what the crowd thinks will happen.

2. **CXC ML Model** — Our custom Gradient Boosted Trees model trained on **10,231 NBA games** across **9 seasons** (2017-2026). We ran a full ablation study and kept only the **12 features** that actually matter (dropped 15 that added noise). It hits **65.6% test accuracy** and **76% accuracy when it's highly confident**.

## WHAT THE MODEL LOOKS AT (translate these into natural language)
The model analyzes these signals — NEVER write the raw variable names in your response. Instead, describe them conversationally:
- Home/away win percentages → "how well the team has been playing at home vs on the road"
- Rest days → "whether a team is well-rested or on a back-to-back" 
- Rolling 5-game scoring margin → "how much they've been winning or losing by lately"
- Rolling field goal percentage → "how well they've been shooting recently"
- Rolling offensive efficiency → "how efficient their offense has been over the last 5 games"
- Head-to-head average margin → "their track record against this specific opponent"
- Home advantage differential → "how much better they play at home vs away"
- FG percentage differential → "the gap in shooting efficiency between the two teams"

## RESPONSE STYLE
- Write **4-6 paragraphs**. Be thorough but readable. Give real analysis, not just numbers.
- Talk like a knowledgeable friend, not a robot. Use phrases like "they've been on fire lately", "this is a classic rest advantage play", "the numbers don't lie", "here's what's interesting though".
- When explaining why the model likes a team, tell a STORY with the data: "The Hawks have been rolling at home this season with a strong home win rate, and they've been outscoring opponents by a healthy margin over their last 5 games. On top of that, the head-to-head history at this arena favors them."
- Always include specific numbers — probabilities, confidence percentages — woven naturally into the narrative.
- When the model and market disagree, get excited about it. Call it an **edge** and explain WHY there's a disconnect.
- For safest bets: look for games where both model AND market agree AND confidence is above 65%.
- Use **bold** for team names, key numbers, and important conclusions.
- Use bullet points when comparing multiple games side by side.
- Say "the model sees", "the data shows", "our analysis points to" — never "I think".
- If someone asks about the model itself, explain the methodology passionately — mention the ablation study, the 9 seasons of training data, the feature engineering process.
- TODAY and TONIGHT = games on the current date shown in the data. Check dates carefully.
- If a team has multiple upcoming games, "tonight" = the one closest to now.
- Be honest if you can't answer something (injuries, trades, lineup changes aren't in the data)."""


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
                temperature=0.75,
                max_tokens=1000,
            )

            result = response.choices[0].message.content
            logger.info(f"Chat OK ({response.usage.total_tokens} tokens)")
            return result

        except Exception as e:
            logger.error(f"Azure OpenAI chat error: {e}")
            return "Sorry, I ran into an error processing your question. Try again in a moment."
