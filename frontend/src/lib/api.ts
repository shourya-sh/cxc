/**
 * API client for CXC backend — Polymarket sports events
 */

const API_BASE = "/api";

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Types ───────────────────────────────────────────────

export interface Outcome {
  name: string;
  probability: number;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  category: string;
  image: string;
  volume: number;
  liquidity: number;
  end_date: string | null;
  outcomes: Outcome[];
  markets_count: number;
}

// ── Events ──────────────────────────────────────────────

export async function fetchEvents(
  category?: string,
  minVolume = 0
): Promise<PolymarketEvent[]> {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (minVolume > 0) params.set("min_volume", String(minVolume));
  const data = await apiFetch<{ events: PolymarketEvent[]; count: number }>(
    `/events?${params}`
  );
  return data.events || [];
}

export async function searchEvents(
  query: string
): Promise<PolymarketEvent[]> {
  const params = new URLSearchParams({ q: query });
  const data = await apiFetch<{ results: PolymarketEvent[]; count: number }>(
    `/events/search?${params}`
  );
  return data.results || [];
}

// ── Prompts (AI) ────────────────────────────────────────

export async function askPrompt(
  prompt: string,
  context?: Record<string, any>
) {
  return apiFetch("/prompts/ask", {
    method: "POST",
    body: JSON.stringify({ prompt, context }),
  });
}
