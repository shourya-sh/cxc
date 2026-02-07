"""
Gemini AI Service — Natural language understanding + recommendation generation
──────────────────────────────────────────────────────────────────────────────
Uses Google's Gemini API to:
1. Parse natural language sports prompts → structured intent
2. Generate human-readable betting recommendations
3. Explain bets in plain language
4. Multi-turn conversation for sports analysis
"""

import os
import json
from typing import Optional
from loguru import logger

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("google-generativeai not installed. Gemini features disabled.")


class GeminiService:

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "")
        self.model_name = "gemini-1.5-flash"
        self._model = None

        if GEMINI_AVAILABLE and self.api_key and self.api_key != "your_gemini_api_key_here":
            genai.configure(api_key=self.api_key)
            self._model = genai.GenerativeModel(self.model_name)
            logger.info("Gemini AI initialized")
        else:
            logger.warning("Gemini API key not set — AI features will use fallback parsing")

    # ── Parse sports prompt into structured intent ──────────
    async def parse_sports_prompt(self, prompt: str) -> Optional[dict]:
        """
        Use Gemini to extract structured intent from a natural language prompt.

        Returns:
            {
                "league": "NBA",
                "home_team": "Los Angeles Lakers",
                "away_team": "Boston Celtics",
                "bet_type": "moneyline",  # moneyline, spread, over_under, prop, mvp
                "search_query": "nba lakers celtics",
                "features": {},
            }
        """
        system_prompt = """You are a sports betting assistant. Parse the user's prompt and extract:
- league: The sports league (NBA, NFL, MLB, NHL, Soccer, MLS, etc.)
- home_team: The home team name
- away_team: The away team name
- bet_type: Type of bet (moneyline, spread, over_under, prop, mvp, championship)
- search_query: Keywords to search a prediction market for this bet
- time_context: When the event is (today, tonight, this week, this season, etc.)

Respond ONLY with valid JSON. If you can't determine a field, use null.
Example:
{"league": "NBA", "home_team": "Los Angeles Lakers", "away_team": "Boston Celtics", "bet_type": "moneyline", "search_query": "nba lakers celtics", "time_context": "tonight"}
"""

        if self._model:
            try:
                response = self._model.generate_content(
                    f"{system_prompt}\n\nUser prompt: {prompt}"
                )
                text = response.text.strip()
                # Strip markdown code fences if present
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                    text = text.rsplit("```", 1)[0]
                return json.loads(text)
            except Exception as e:
                logger.error(f"Gemini parse error: {e}")
                # Fall through to fallback
        
        # ── Fallback: keyword-based parsing ──────────────
        return self._fallback_parse(prompt)

    # ── Generate betting recommendation ──────────────────
    async def generate_recommendation(
        self,
        user_prompt: str,
        parsed_intent: dict,
        polymarket_data: list[dict],
        ml_prediction: Optional[dict] = None,
    ) -> dict:
        """
        Combine Polymarket data + ML prediction to generate a
        human-readable recommendation.
        """
        if self._model:
            try:
                context = f"""User asked: "{user_prompt}"

Parsed intent: {json.dumps(parsed_intent, indent=2)}

Polymarket data found ({len(polymarket_data)} markets):
{json.dumps(polymarket_data[:3], indent=2)}

ML Model prediction:
{json.dumps(ml_prediction, indent=2) if ml_prediction else "No prediction available"}

Based on this data, provide:
1. A clear recommendation on what bet to make
2. The confidence level (low/medium/high)
3. Key factors supporting the recommendation
4. Risk assessment
5. If there's value between the ML prediction and market odds

Respond in JSON format:
{{"recommendation": "...", "confidence": "high/medium/low", "key_factors": ["..."], "risk": "...", "value_bet": true/false, "explanation": "..."}}"""

                response = self._model.generate_content(context)
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                    text = text.rsplit("```", 1)[0]
                return json.loads(text)
            except Exception as e:
                logger.error(f"Gemini recommendation error: {e}")

        # ── Fallback recommendation ──────────────────────
        return self._fallback_recommendation(ml_prediction, polymarket_data)

    # ── Chat (multi-turn) ────────────────────────────────
    async def chat(self, messages: list[dict]) -> dict:
        """
        Multi-turn conversation about sports bets.
        messages: [{"role": "user"/"model", "content": "..."}]
        """
        if self._model:
            try:
                chat = self._model.start_chat(
                    history=[
                        {"role": m["role"], "parts": [m["content"]]}
                        for m in messages[:-1]
                    ]
                )
                response = chat.send_message(messages[-1]["content"])
                return {"role": "model", "content": response.text}
            except Exception as e:
                logger.error(f"Gemini chat error: {e}")

        return {
            "role": "model",
            "content": "AI chat is currently unavailable. Please set your GEMINI_API_KEY."
        }

    # ── Explain bet in plain language ────────────────────
    async def explain_in_plain_language(self, prompt: str) -> str:
        """Explain a bet concept or market in simple terms."""
        if self._model:
            try:
                response = self._model.generate_content(
                    f"Explain this sports bet or concept in simple, clear language "
                    f"that a beginner would understand. Keep it concise (2-3 paragraphs max):\n\n{prompt}"
                )
                return response.text
            except Exception as e:
                logger.error(f"Gemini explain error: {e}")

        return "AI explanation unavailable. Please set your GEMINI_API_KEY in .env"

    async def estimate_outcome_probabilities(self, title: str, outcomes: list[str]) -> dict[str, float] | None:
        """
        Ask Gemini to estimate outcome probabilities for a given event title and outcome names.
        Returns a mapping {outcome_name: probability} (sum ~1.0) or None if AI unavailable.
        """
        if not self._model:
            return None

        prompt = (
            f"You are an expert sports analyst. For the event titled:\n\n{title}\n\n"
            f"Estimate the probability of each of the following outcomes as decimals between 0 and 1 that sum to 1. "
            f"Return ONLY valid JSON mapping outcome names to decimal probabilities.\n\nOutcomes: {json.dumps(outcomes)}\n\n"
            "Example response: {\"Team A\": 0.38, \"Team B\": 0.62}"
        )

        try:
            response = self._model.generate_content(prompt)
            text = response.text.strip()
            # Strip fences
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            probs = json.loads(text)
            # Normalize + cast to floats
            clean: dict[str, float] = {}
            total = 0.0
            for k, v in probs.items():
                try:
                    f = float(v)
                except (ValueError, TypeError):
                    f = 0.0
                clean[k] = f
                total += f
            # If total is 0 or NaN, abort
            if total <= 0:
                return None
            # Normalize
            for k in list(clean.keys()):
                clean[k] = max(0.0, min(1.0, clean[k] / total))
            return clean
        except Exception as e:
            logger.error(f"Gemini estimate error: {e}")
            return None

    # ── Fallback parsing (no Gemini) ─────────────────────
    def _fallback_parse(self, prompt: str) -> dict:
        """Simple keyword-based parsing when Gemini is unavailable."""
        prompt_lower = prompt.lower()

        # Detect league
        league = None
        league_map = {
            "nba": "NBA", "basketball": "NBA",
            "nfl": "NFL", "football": "NFL",
            "mlb": "MLB", "baseball": "MLB",
            "nhl": "NHL", "hockey": "NHL",
            "soccer": "Soccer", "premier league": "Soccer",
            "mls": "MLS",
        }
        for key, val in league_map.items():
            if key in prompt_lower:
                league = val
                break

        # Detect bet type
        bet_type = "moneyline"
        if "mvp" in prompt_lower:
            bet_type = "mvp"
        elif "champion" in prompt_lower or "win the" in prompt_lower:
            bet_type = "championship"
        elif "spread" in prompt_lower:
            bet_type = "spread"
        elif "over" in prompt_lower and "under" in prompt_lower:
            bet_type = "over_under"
        elif "prop" in prompt_lower:
            bet_type = "prop"

        # Build search query from significant words
        stop_words = {"who", "what", "should", "i", "bet", "on", "the", "in", "a", "to", "will", "win"}
        words = [w for w in prompt_lower.split() if w not in stop_words and len(w) > 2]
        search_query = " ".join(words[:5])

        return {
            "league": league,
            "home_team": None,
            "away_team": None,
            "bet_type": bet_type,
            "search_query": search_query,
            "time_context": None,
        }

    def _fallback_recommendation(self, ml_prediction: Optional[dict], markets: list[dict]) -> dict:
        """Generate a basic recommendation without Gemini."""
        if ml_prediction and not ml_prediction.get("is_placeholder"):
            winner = ml_prediction.get("predicted_winner", "Unknown")
            confidence = ml_prediction.get("confidence", 0)
            conf_label = "high" if confidence > 0.7 else "medium" if confidence > 0.4 else "low"
            return {
                "recommendation": f"ML model favors {winner}",
                "confidence": conf_label,
                "key_factors": ["Based on ML model prediction"],
                "risk": "Medium — model trained on limited data" if ml_prediction.get("is_placeholder") else "Assess based on model accuracy",
                "value_bet": False,
                "explanation": ml_prediction.get("recommendation", "No detailed analysis available without AI."),
            }

        return {
            "recommendation": "Unable to generate recommendation — no model or AI available",
            "confidence": "low",
            "key_factors": [],
            "risk": "Unknown",
            "value_bet": False,
            "explanation": "Set up your GEMINI_API_KEY and train the ML model for recommendations.",
        }
