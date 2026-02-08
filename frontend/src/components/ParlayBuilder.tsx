"use client";

import { NBAGame } from "@/lib/api";
import { X, Layers, TrendingUp, Trash2, ChevronRight, Zap, Target, DollarSign, Brain, AlertTriangle, CheckCircle, Info, BarChart3 } from "lucide-react";

/** A single leg in the parlay */
export interface ParlayLeg {
  game: NBAGame;
  pickedTeam: string;
  modelProb: number;
  marketProb: number;
}

interface ParlayBuilderProps {
  legs: ParlayLeg[];
  onRemoveLeg: (gameId: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const TEAM_LOGO_ID: Record<string, number> = {
  hawks: 1610612737, celtics: 1610612738, nets: 1610612751,
  hornets: 1610612766, bulls: 1610612741, cavaliers: 1610612739,
  mavericks: 1610612742, nuggets: 1610612743, pistons: 1610612765,
  warriors: 1610612744, rockets: 1610612745, pacers: 1610612754,
  clippers: 1610612746, lakers: 1610612747, grizzlies: 1610612763,
  heat: 1610612748, bucks: 1610612749, timberwolves: 1610612750,
  pelicans: 1610612740, knicks: 1610612752, thunder: 1610612760,
  magic: 1610612753, "76ers": 1610612755, suns: 1610612756,
  "trail blazers": 1610612757, blazers: 1610612757,
  kings: 1610612758, spurs: 1610612759, raptors: 1610612761,
  jazz: 1610612762, wizards: 1610612764,
};

function getTeamLogoUrl(name: string): string | null {
  const key = name.trim().toLowerCase();
  const id = TEAM_LOGO_ID[key];
  if (!id) return null;
  return `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg`;
}

/** Convert probability (0-1) to American odds string */
function probToAmericanOdds(prob: number): string {
  if (prob <= 0.01) return "+9999";
  if (prob >= 0.99) return "-9999";
  if (prob >= 0.5) {
    const odds = Math.round((prob / (1 - prob)) * -100);
    return `${odds}`;
  } else {
    const odds = Math.round(((1 - prob) / prob) * 100);
    return `+${odds}`;
  }
}

/** Convert probability to decimal odds */
function probToDecimalOdds(prob: number): number {
  if (prob <= 0.01) return 100;
  return 1 / prob;
}

/** Convert combined decimal odds to American odds */
function decimalToAmericanOdds(decimal: number): string {
  if (decimal >= 2.0) {
    const american = Math.round((decimal - 1) * 100);
    return `+${american}`;
  } else {
    const american = Math.round(-100 / (decimal - 1));
    return `${american}`;
  }
}

/** Generate reasoning bullets for a parlay */
function generateParlayReasoning(legs: ParlayLeg[]): { text: string; type: "positive" | "negative" | "neutral" }[] {
  if (legs.length === 0) return [];
  const reasons: { text: string; type: "positive" | "negative" | "neutral" }[] = [];

  const combinedModelProb = legs.reduce((p, l) => p * l.modelProb, 1);
  const combinedMarketProb = legs.reduce((p, l) => p * l.marketProb, 1);
  const avgModelProb = legs.reduce((s, l) => s + l.modelProb, 0) / legs.length;

  // Edge value
  const edgeRatio = combinedModelProb / combinedMarketProb;
  if (edgeRatio > 1.15) {
    reasons.push({
      text: `Our model gives this parlay ${((edgeRatio - 1) * 100).toFixed(0)}% better odds than the market — strong value play.`,
      type: "positive",
    });
  } else if (edgeRatio > 1.0) {
    reasons.push({
      text: `Model rates this ${((edgeRatio - 1) * 100).toFixed(0)}% above market odds — slight edge detected.`,
      type: "positive",
    });
  } else if (edgeRatio < 0.85) {
    reasons.push({
      text: `Market odds are more favorable than our model — you're paying a premium on this parlay.`,
      type: "negative",
    });
  }

  // Individual leg analysis
  const strongLegs = legs.filter((l) => l.modelProb >= 0.6);
  const weakLegs = legs.filter((l) => l.modelProb < 0.45);
  const edgeLegs = legs.filter((l) => (l.modelProb > 0.5) !== (l.marketProb > 0.5));

  if (strongLegs.length > 0) {
    const names = strongLegs.map((l) => l.pickedTeam).join(", ");
    reasons.push({
      text: `${names} ${strongLegs.length === 1 ? "is a" : "are"} strong pick${strongLegs.length > 1 ? "s" : ""} with 60%+ model confidence — anchoring this parlay.`,
      type: "positive",
    });
  }

  if (weakLegs.length > 0) {
    const names = weakLegs.map((l) => l.pickedTeam).join(", ");
    reasons.push({
      text: `${names} ${weakLegs.length === 1 ? "is an" : "are"} underdog pick${weakLegs.length > 1 ? "s" : ""} (below 45%) — higher risk but boosts payout.`,
      type: "negative",
    });
  }

  if (edgeLegs.length > 0) {
    reasons.push({
      text: `${edgeLegs.length} pick${edgeLegs.length > 1 ? "s go" : " goes"} against the market consensus — our model spots value the market is missing.`,
      type: "positive",
    });
  }

  // Consensus alignment
  const allAgree = legs.every((l) => (l.modelProb > 0.5 && l.marketProb > 0.5) || (l.modelProb < 0.5 && l.marketProb < 0.5));
  if (allAgree && legs.length >= 2) {
    reasons.push({
      text: `All picks align with market favorites — consensus-backed, lower variance.`,
      type: "positive",
    });
  }

  // Leg count
  const mktPayout = legs.reduce((acc, l) => acc * probToDecimalOdds(l.marketProb), 1);
  if (legs.length === 2) {
    reasons.push({ text: `2-leg parlay keeps risk manageable while offering ${mktPayout.toFixed(1)}x payout.`, type: "positive" });
  } else if (legs.length === 3) {
    reasons.push({ text: `3-leg sweet spot — balanced risk-reward with a ${mktPayout.toFixed(1)}x multiplier.`, type: "neutral" });
  } else if (legs.length >= 4 && legs.length <= 5) {
    reasons.push({ text: `${legs.length}-leg parlay is aggressive — big payout potential but each leg adds compounding risk.`, type: "negative" });
  } else if (legs.length > 5) {
    reasons.push({ text: `${legs.length} legs is a lottery ticket — exciting payout but historically very difficult to hit.`, type: "negative" });
  }

  // Average confidence
  if (avgModelProb >= 0.65) {
    reasons.push({ text: `Average model confidence of ${(avgModelProb * 100).toFixed(0)}% — each leg is individually strong.`, type: "positive" });
  } else if (avgModelProb < 0.52) {
    reasons.push({ text: `Average model confidence is only ${(avgModelProb * 100).toFixed(0)}% — several coin-flip picks weaken the overall odds.`, type: "negative" });
  }

  // EV analysis
  const fairPayout = 1 / combinedModelProb;
  const ev = ((fairPayout / mktPayout) - 1) * 100;
  if (ev > 5) {
    reasons.push({ text: `Estimated +EV of ${ev.toFixed(0)}% — the true odds are better than what the payout implies.`, type: "positive" });
  } else if (ev < -10) {
    reasons.push({ text: `Negative expected value (${ev.toFixed(0)}%) — the market payout doesn't fully compensate for the risk.`, type: "negative" });
  }

  return reasons;
}

/** Grade the parlay based on combined model confidence */
function getParlayGrade(legs: ParlayLeg[]): {
  grade: string; color: string; bg: string; label: string;
} {
  if (legs.length === 0) return { grade: "—", color: "#71717a", bg: "rgba(113,113,122,0.1)", label: "Add picks" };

  const avgConf = legs.reduce((s, l) => s + l.modelProb, 0) / legs.length;
  const combinedProb = legs.reduce((p, l) => p * l.modelProb, 1);
  const allAgree = legs.every((l) => {
    return (l.modelProb > 0.5 && l.marketProb > 0.5) || (l.modelProb < 0.5 && l.marketProb < 0.5);
  });

  let score = avgConf * 50 + (allAgree ? 20 : 0);
  if (legs.length <= 2) score += 10;
  if (legs.length >= 5) score -= 15;
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

  // Use market odds for actual payout (how real sportsbooks calculate parlays)
  const marketDecimalOdds = legs.length > 0 ? legs.reduce((acc, l) => acc * probToDecimalOdds(l.marketProb), 1) : 0;
  const parlayAmericanOdds = marketDecimalOdds > 0 ? decimalToAmericanOdds(marketDecimalOdds) : "+0";
  const grade = getParlayGrade(legs);
  const reasoning = generateParlayReasoning(legs);

  // Floating button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #6366f1 100%)",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(139,92,246,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset",
        }}
      >
        <Layers size={18} />
        Parlay Builder
        {legs.length > 0 && (
          <span className="ml-1 w-6 h-6 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xs font-black">
            {legs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onToggle} />

      {/* Slide-in panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col parlay-panel-slide">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, #a78bfa, #818cf8, #6366f1, #8b5cf6)" }} />

        {/* Panel header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]"
          style={{ background: "rgba(17,17,19,0.98)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
              <Layers size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">Parlay Builder</h2>
              <p className="text-[11px] text-text-muted">
                {legs.length === 0 ? "Tap a team to add picks" : `${legs.length} leg${legs.length > 1 ? "s" : ""} selected`}
              </p>
            </div>
          </div>
          <button onClick={onToggle} className="p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        {/* Parlay grade + stats */}
        {legs.length > 0 && (
          <div className="p-5 border-b border-white/[0.06]" style={{ background: "rgba(17,17,19,0.98)" }}>
            <div className="flex items-center gap-5">
              {/* Grade badge */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{ background: grade.bg, border: `2px solid ${grade.color}40` }}>
                  <div className="absolute inset-0 opacity-20"
                    style={{ background: `radial-gradient(circle at center, ${grade.color}, transparent 70%)` }} />
                  <span className="text-3xl font-black relative" style={{ color: grade.color }}>
                    {grade.grade}
                  </span>
                </div>
                <span className="text-[10px] font-bold mt-1.5 tracking-wide" style={{ color: grade.color }}>
                  {grade.label}
                </span>
              </div>

              {/* Stats grid */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Parlay Odds</p>
                  <p className="text-xl font-black text-text-primary mt-0.5">
                    {parlayAmericanOdds}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Payout</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: "#34d399" }}>
                    {marketDecimalOdds.toFixed(1)}x
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Win Prob</p>
                  <p className="text-xl font-black text-text-primary mt-0.5">
                    {(combinedModelProb * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Mkt Prob</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: "#a78bfa" }}>
                    {(combinedMarketProb * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Payout example */}
            <div className="mt-4 rounded-2xl p-4 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(34,211,238,0.08))", border: "1px solid rgba(52,211,153,0.15)" }}>
              <div className="flex items-center gap-2">
                <DollarSign size={16} style={{ color: "#34d399" }} />
                <span className="text-sm text-text-muted font-medium">$100 bet returns</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-black" style={{ color: "#34d399" }}>
                  ${(100 * marketDecimalOdds).toFixed(0)}
                </span>
                <span className="text-[10px] text-text-muted font-medium">
                  (${(100 * marketDecimalOdds - 100).toFixed(0)} profit)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto" style={{ background: "rgba(17,17,19,0.98)" }}>
          {legs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(167,139,250,0.08)" }}>
                <Layers size={28} className="text-text-muted opacity-40" />
              </div>
              <p className="text-sm font-semibold text-text-muted mb-1">No picks yet</p>
              <p className="text-xs text-text-muted/60 max-w-[200px]">
                Click on a team logo in any game card to start building your parlay
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Legs list */}
              <div className="space-y-2.5">
                {legs.map((leg, idx) => {
                  const isModelFav = leg.modelProb > 0.5;
                  const logoUrl = getTeamLogoUrl(leg.pickedTeam);
                  const legDecimalOdds = probToDecimalOdds(leg.marketProb);
                  const legAmericanOdds = probToAmericanOdds(leg.marketProb);
                  const modelAmericanOdds = probToAmericanOdds(leg.modelProb);
                  const hasEdge = (leg.modelProb > 0.5) !== (leg.marketProb > 0.5);

                  return (
                    <div
                      key={leg.game.id}
                      className="rounded-2xl p-4 group transition-all hover:bg-white/[0.04]"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Leg number */}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                          style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
                          {idx + 1}
                        </div>

                        {/* Team logo */}
                        {logoUrl && (
                          <img src={logoUrl} alt={leg.pickedTeam} className="w-10 h-10 object-contain flex-shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-text-primary truncate">
                              {leg.pickedTeam}
                            </p>
                            {isModelFav && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                                FAV
                              </span>
                            )}
                            {hasEdge && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                                style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c" }}>
                                EDGE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5 truncate">
                            {leg.game.title}
                          </p>
                        </div>

                        {/* Odds display */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-black text-text-primary">
                            {legAmericanOdds}
                          </p>
                          <p className="text-[10px] text-text-muted font-medium">
                            {legDecimalOdds.toFixed(2)}x
                          </p>
                        </div>

                        <button
                          onClick={() => onRemoveLeg(leg.game.id)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all text-text-muted hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Leg detail row */}
                      <div className="flex items-center gap-3 mt-2 ml-9 pl-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-text-muted">Market</span>
                          <span className="text-[10px] font-bold" style={{ color: "#a78bfa" }}>
                            {(leg.marketProb * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center gap-1">
                          <Brain size={8} className="text-emerald-400" />
                          <span className="text-[9px] text-text-muted">Model</span>
                          <span className="text-[10px] font-bold" style={{ color: "#34d399" }}>
                            {(leg.modelProb * 100).toFixed(0)}% ({modelAmericanOdds})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Odds Breakdown */}
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={14} style={{ color: "#a78bfa" }} />
                  <span className="text-xs font-bold text-text-primary">Odds Breakdown</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">Combined Market Odds</span>
                    <span className="text-sm font-black text-text-primary">{parlayAmericanOdds}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">Decimal Odds</span>
                    <span className="text-sm font-bold text-text-primary">{marketDecimalOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">Implied Probability (Market)</span>
                    <span className="text-sm font-bold" style={{ color: "#a78bfa" }}>{(combinedMarketProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">Model Win Probability</span>
                    <span className="text-sm font-bold" style={{ color: "#34d399" }}>{(combinedModelProb * 100).toFixed(1)}%</span>
                  </div>
                  {combinedModelProb > combinedMarketProb && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[11px] font-semibold" style={{ color: "#34d399" }}>Model Edge</span>
                      <span className="text-sm font-black" style={{ color: "#34d399" }}>
                        +{((combinedModelProb / combinedMarketProb - 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Reasoning */}
              {reasoning.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={14} style={{ color: "#22d3ee" }} />
                    <span className="text-xs font-bold text-text-primary">AI Analysis</span>
                  </div>
                  <div className="space-y-2.5">
                    {reasoning.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {r.type === "positive" && <CheckCircle size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#34d399" }} />}
                        {r.type === "negative" && <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#f97316" }} />}
                        {r.type === "neutral" && <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#60a5fa" }} />}
                        <p className="text-[11px] leading-relaxed text-text-secondary">{r.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {legs.length > 0 && (
          <div className="p-5 border-t border-white/[0.06]" style={{ background: "rgba(17,17,19,0.98)" }}>
            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-red-500/10 hover:text-red-400 text-text-muted"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
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
