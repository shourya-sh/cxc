"use client";

import { useEffect, useState } from "react";
import { PolymarketEvent } from "@/lib/api";
import DonutChart from "./DonutChart";
import ProbabilityBars from "./ProbabilityBars";
import ProjectedProfitChart from "./ProjectedProfitChart";
import { X, Calculator, Database, ExternalLink } from "lucide-react";

interface ProjectionRow {
  name: string;
  market_probability: number;
  predicted_probability: number;
  stake: number;
  expected_profit: number;
  expected_return: number;
  roi: number;
  market_id?: string;
  question?: string;
}

interface EventModalProps {
  event: PolymarketEvent | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const [stake, setStake] = useState<number>(100);
  const [mode, setMode] = useState<"market" | "ai">("market");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProjectionRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    // Reset on open
    setRows([]);
    setSummary(null);
    setError(null);
    fetchProjection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  const fetchProjection = async () => {
    if (!event) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ stake: String(stake), mode });
      const res = await fetch(`/api/events/${event.id}/projection?${q}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch projection");
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-[80vw] h-[80vh] max-w-[1200px] z-10">
        {/* translucent backdrop card */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-2xl" />
        <div className="relative z-20 w-full h-full bg-bg-card/70 border border-border rounded-2xl p-6 overflow-hidden flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">{event.title}</h3>
              <p className="text-sm text-text-muted mt-1">{event.category} • {event.markets_count} markets</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={`https://polymarket.com/market/${event.slug}`} target="_blank" rel="noreferrer" className="px-3 py-2 text-xs text-text-muted bg-bg-elevated rounded-md flex items-center gap-2">
                <ExternalLink size={14} />
                Open
              </a>
              <button className="px-3 py-2 text-xs text-text-muted bg-bg-elevated rounded-md" onClick={fetchProjection} disabled={loading}>
                <Calculator size={14} />
              </button>
              <button className="px-3 py-2 rounded-md bg-bg-elevated text-text-muted" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 h-[calc(100%-110px)] grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4 h-full">
              <div className="relative flex-1 rounded-lg overflow-hidden p-3">
                {/* Glow background */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(11,11,13,0.6), rgba(11,11,13,0.2))' }} />
                <ProjectedProfitChart rows={rows} total={summary?.total_expected_profit || 0} eventId={String(event.id)} points={18} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-text-muted">Stake</label>
                  <input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="w-28 px-3 py-2 rounded-md bg-bg-elevated border border-border text-text-primary"
                  />
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <label className="text-xs text-text-muted">Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="px-3 py-2 bg-bg-elevated border border-border rounded-md text-sm">
                    <option value="market">Market</option>
                    <option value="ai">AI estimate</option>
                  </select>
                </div>

                <div className="ml-auto text-sm text-text-muted">
                  {loading ? "Calculating..." : summary ? `Best: ${summary.best_outcome} • Expected $${summary.best_expected_profit}` : ""}
                </div>
              </div>

            </div>

            <div className="lg:col-span-1 flex flex-col gap-3">
              <div className="glass-card p-4">
                <p className="text-xs text-text-muted">Key metrics</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-muted">Total Volume</div>
                    <div className="text-sm font-semibold">${event.volume?.toLocaleString?.() || String(event.volume)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-muted">Total Expected Profit</div>
                    <div className="text-sm font-semibold">${summary?.total_expected_profit?.toFixed?.(2) ?? "0.00"}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-muted">Best Outcome</div>
                    <div className="text-sm font-semibold">{summary?.best_outcome ?? "-"}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-muted">Markets</div>
                    <div className="text-sm font-semibold">{event.markets_count}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-muted">Ends</div>
                    <div className="text-sm font-semibold">{event.end_date ? new Date(event.end_date).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-4">
                <p className="text-xs text-text-muted">Top outcomes</p>
                <div className="mt-3 space-y-2">
                  {rows.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="text-sm truncate max-w-[160px]">{r.name}</div>
                      <div className="text-sm font-semibold">{(r.predicted_probability*100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4 mt-auto flex items-center justify-between">
                <div className="text-xs text-text-muted">Projection is an estimate and may be inaccurate.</div>
                <a href={`https://polymarket.com`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Go to Polymarket</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
