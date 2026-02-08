/**
 * API client — Polymarket NBA data + ML Predictions
 */

const API_BASE = "/api";

async function apiFetch<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Types ───────────────────────────────────────────────

export interface Outcome {
  name: string;
  probability: number;
}

export interface Team {
  name: string;
  probability: number;
}

/** Model prediction for a single game */
export interface GamePrediction {
  game_id: string;
  home_team: string;
  away_team: string;
  home_win_probability: number;
  away_win_probability: number;
  predicted_winner: string;
  confidence: number;
  model_accuracy: number;
  model_type: string;
  features_used: number;
  predicted_home_score?: number;
  predicted_away_score?: number;
  predicted_total?: number;
  predicted_margin?: number;
}

/** An NBA game matchup (e.g. "Celtics vs. Pistons") */
export interface NBAGame {
  id: string;
  type: "game";
  title: string;
  slug: string;
  description: string;
  image: string;
  category: string;
  game_date: string;
  volume: number;
  liquidity: number;
  competitive: number;
  teams: Team[];
  outcomes: Outcome[];
  markets_count: number;
  prediction?: GamePrediction | null;
}

/** An NBA futures market (e.g. "2026 NBA Champion") */
export interface NBAFuture {
  id: string;
  type: "future";
  title: string;
  slug: string;
  image: string;
  category: string;
  volume: number;
  liquidity: number;
  end_date: string | null;
  outcomes: Outcome[];
  markets_count: number;
}

export type NBAEvent = NBAGame | NBAFuture;

/** Model metadata for analysis page */
export interface ChartInfo {
  id: string;
  file: string;
  title: string;
}

export interface ModelInfo {
  model_type: string;
  features: string[];
  dropped_features: string[];
  metrics: {
    accuracy: number;
    temporal_accuracy: number;
    auc: number;
    f1: number;
    total_games: number;
  };
  available_charts: ChartInfo[];
}

// ── API calls ───────────────────────────────────────────

/** Fetch all NBA data: games + futures */
export async function fetchAllNBA(): Promise<{ games: NBAGame[]; futures: NBAFuture[] }> {
  return apiFetch("/events");
}

/** Fetch only NBA games */
export async function fetchNBAGames(): Promise<NBAGame[]> {
  const data = await apiFetch<{ games: NBAGame[]; count: number }>("/events/games");
  return data.games || [];
}

/** Fetch only NBA futures */
export async function fetchNBAFutures(): Promise<NBAFuture[]> {
  const data = await apiFetch<{ futures: NBAFuture[]; count: number }>("/events/futures");
  return data.futures || [];
}

/** Search NBA events */
export async function searchEvents(query: string): Promise<NBAEvent[]> {
  const params = new URLSearchParams({ q: query });
  const data = await apiFetch<{ results: NBAEvent[]; count: number }>(
    `/events/search?${params}`
  );
  return data.results || [];
}

/** Fetch games with ML predictions attached */
export async function fetchPredictions(): Promise<{ games: NBAGame[]; model_accuracy: number | null }> {
  return apiFetch("/predictions");
}

/** Fetch model metadata + available charts */
export async function fetchModelInfo(): Promise<ModelInfo> {
  return apiFetch("/predictions/model-info");
}

/** Get chart image URL */
export function getChartUrl(filename: string): string {
  return `${API_BASE}/charts/${filename}`;
}

/** Send a chat message to the AI analyst */
export async function sendChatMessage(message: string): Promise<string> {
  // POST directly to backend to avoid Next.js rewrite redirect issues
  const res = await fetch("http://localhost:8000/api/chat/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.response;
}
