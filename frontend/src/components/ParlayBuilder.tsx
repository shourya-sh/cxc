"use client";

import { NBAGame } from "@/lib/api";
import { X, Layers, TrendingUp, Trash2, ChevronRight } from "lucide-react";

/** A single leg in the parlay */
export interface ParlayLeg {
  game: NBAGame;
  pickedTeam: string;         // team name user picked to win
  modelProb: number;          // model's probability for this pick (0-1)
  marketProb: number;         // polymarket probability for this pick (0-1)
}

interface ParlayBuilderProps {
  legs: ParlayLeg[];
  onRemoveLeg: (gameId: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

/** Convert probability to American odds string */
function probToAmericanOdds(prob: number): string {
  if (prob >= 0.5) {
    const odds = Math.round((prob / (1 - prob)) * -100);
    return `${odds}`;
  } else {
    const odds = Math.round(((1 - prob) / prob) * 100);
    return `+${odds}`;
  }
}

/** Grade the parlay based on combined model confidence */
function getParlayGrade(legs: ParlayLeg[]): {
  grade: string; color: string; bg: string; label: string;
} {
  if (legs.length === 0) return { grade: "—", color: "#71717a", bg: "rgba(113,113,122,0.1)", label: "Add picks" };

  const avgConf = legs.reduce((s, l) => s + l.modelProb, 0) / legs.length;
  const combinedProb = legs.reduce((p, l) => p * l.modelProb, 1);
  const allAgree = legs.every((l) => {
    // model and market agree on who wins
    return (l.modelProb > 0.5 && l.marketProb > 0.5) || (l.modelProb < 0.5 && l.marketProb < 0.5);
  });

  let score = avgConf * 50 + (allAgree ? 20 : 0);
  if (legs.length <= 2) score += 10;      // fewer legs = safer
  if (legs.length >= 5) score -= 15;      // 5+ legs = very risky
  if (combinedProb > 0.3) score += 10;
  if (combinedProb < 0.1) score -= 10;

  if (score >= 65) return { grade: "A+", color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Strong Parlay" };
  if (score >= 55) return { grade: "A",  color: "#34d399", bg: "rgba(52,211,153,0.12)", label: "Great Parlay" };
  if (score >= 45) return { grade: "B+", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", label: "Good Parlay" };
  if (score >= 35) return { grade: "B",  color: "#818cf8", bg: "rgba(129,140,248,0.12)", label: "Decent" };
  if (score >= 25) return { grade: "C",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "Risky" };
  if (score >= 15) return { grade: "D",  color: "#f97316", bg: "rgba(249,115,22,0.12)", label: "Long Shot" };
  return                  { grade: "F",  color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Degen Mode" };
}

export default function ParlayBuilder({ legs, onRemoveLeg, onClear, isOpen, onToggle }: ParlayBuilderProps) {
  const combinedModelProb = legs.length > 0 ? legs.reduce((p, l) => p * l.modelProb, 1) : 0;
  const combinedMarketProb = legs.length > 0 ? legs.reduce((p, l) => p * l.marketProb, 1) : 0;
  const payoutMultiplier = combinedModelProb > 0 ? 1 / combinedModelProb : 0;
  const marketPayout = combinedMarketProb > 0 ? 1 / combinedMarketProb : 0;
  const grade = getParlayGrade(legs);

  // Floating button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/20"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)",
          color: "#09090b",
        }}
      >
        <Layers size={16} />
        Parlay Builder
        {legs.length > 0 && (
          <span className="ml-1 w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold">
            {legs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onToggle} />

      {/* Slide-in panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col"
        style={{ background: "#111113", borderLeft: "1px solid #27272a" }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)" }}>
              <Layers size={15} className="text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Parlay Builder</h2>
              <p className="text-[11px] text-text-muted">
                {legs.length === 0 ? "Tap a team to add picks" : `${legs.length} leg${legs.length > 1 ? "s" : ""} selected`}
              </p>
            </div>
          </div>
          <button onClick={onToggle} className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Parlay grade + stats */}
        {legs.length > 0 && (
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-4">
              {/* Grade badge */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: grade.bg, border: `2px solid ${grade.color}40` }}>
                  <span className="text-2xl font-black" style={{ color: grade.color }}>
                    {grade.grade}
                  </span>
                </div>
                <span className="text-[10px] font-semibold mt-1" style={{ color: grade.color }}>
                  {grade.label}
                </span>
              </div>

              {/* Stats grid */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="bg-bg-elevated rounded-lg px-3 py-2">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide">Win Prob</p>
                  <p className="text-lg font-bold text-text-primary">
                    {(combinedModelProb * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-bg-elevated rounded-lg px-3 py-2">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide">Payout</p>
                  <p className="text-lg font-bold" style={{ color: "#34d399" }}>
                    {payoutMultiplier.toFixed(1)}x
                  </p>
                </div>
                <div className="bg-bg-elevated rounded-lg px-3 py-2">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide">Market Prob</p>
                  <p className="text-lg font-bold text-text-primary">
                    {(combinedMarketProb * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-bg-elevated rounded-lg px-3 py-2">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide">Market Pay</p>
                  <p className="text-lg font-bold" style={{ color: "#a78bfa" }}>
                    {marketPayout.toFixed(1)}x
                  </p>
                </div>
              </div>
            </div>

            {/* Payout example */}
            <div className="mt-3 bg-bg-elevated rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-text-muted">$100 bet returns</span>
              <span className="text-base font-bold" style={{ color: "#34d399" }}>
                ${(100 * payoutMultiplier).toFixed(0)}
              </span>
            </div>
          </div>
        )}

        {/* Legs list */}
        <div className="flex-1 overflow-y-auto p-5">
          {legs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Layers size={32} className="text-text-muted mb-3 opacity-40" />
              <p className="text-sm text-text-muted mb-1">No picks yet</p>
              <p className="text-xs text-text-muted/60">
                Click on a team name in any game card to add it to your parlay
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {legs.map((leg) => {
                const isModelFav = leg.modelProb > 0.5;
                return (
                  <div
                    key={leg.game.id}
                    className="bg-bg-elevated rounded-xl p-3 flex items-center gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ChevronRight size={10} style={{ color: "#34d399" }} />
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {leg.pickedTeam}
                        </p>
                        {isModelFav && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                            Model Fav
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">
                        {leg.game.title}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-text-primary">
                        {(leg.modelProb * 100).toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {probToAmericanOdds(leg.marketProb)}
                      </p>
                    </div>

                    <button
                      onClick={() => onRemoveLeg(leg.game.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all text-text-muted hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {legs.length > 0 && (
          <div className="p-5 border-t border-border">
            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-bg-elevated text-text-secondary hover:text-red-400 hover:bg-red-500/10 border border-border transition-all"
            >
              <Trash2 size={14} />
              Clear All Picks
            </button>
          </div>
        )}
      </div>
    </>
  );
}
