"use client";

import { NBAGame } from "@/lib/api";
import { ParlayLeg } from "@/components/ParlayBuilder";
import { Zap, TrendingUp, Shield, Flame, ChevronRight, Layers, Brain, CheckCircle } from "lucide-react";

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

/** Convert probability to American odds */
function probToAmericanOdds(prob: number): string {
  if (prob <= 0.01) return "+9999";
  if (prob >= 0.99) return "-9999";
  if (prob >= 0.5) {
    return `${Math.round((prob / (1 - prob)) * -100)}`;
  }
  return `+${Math.round(((1 - prob) / prob) * 100)}`;
}

/** Convert probability to decimal odds */
function probToDecimalOdds(prob: number): number {
  if (prob <= 0.01) return 100;
  return 1 / prob;
}

/** Convert combined decimal odds to American odds */
function decimalToAmericanOdds(decimal: number): string {
  if (decimal >= 2.0) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

interface SuggestedParlaysProps {
  games: NBAGame[];
  onApplyParlay: (legs: ParlayLeg[]) => void;
}

interface SuggestedParlay {
  name: string;
  description: string;
  reasoning: string[];
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  legs: ParlayLeg[];
  combinedProb: number;
  marketDecimalOdds: number;
  americanOdds: string;
}

function buildParlayLeg(game: NBAGame, teamName: string): ParlayLeg {
  const [t1, t2] = game.teams;
  const pred = game.prediction;
  let modelProb = 0.5;
  let marketProb = 0.5;

  if (pred && t1 && t2) {
    const t1Lower = t1.name.toLowerCase();
    const homeLower = pred.home_team.toLowerCase();
    const isT1Home = t1Lower.includes(homeLower) || homeLower.includes(t1Lower);

    if (teamName === t1.name) {
      modelProb = isT1Home ? pred.home_win_probability : pred.away_win_probability;
      marketProb = t1.probability;
    } else {
      modelProb = isT1Home ? pred.away_win_probability : pred.home_win_probability;
      marketProb = t2.probability;
    }
  } else if (t1 && t2) {
    marketProb = teamName === t1.name ? t1.probability : t2.probability;
    modelProb = marketProb;
  }

  return { game, pickedTeam: teamName, modelProb, marketProb };
}

export default function SuggestedParlays({ games, onApplyParlay }: SuggestedParlaysProps) {
  const gamesWithPreds = games.filter((g) => g.prediction && g.teams.length === 2);
  if (gamesWithPreds.length < 2) return null;

  // Build suggestions
  const suggestions: SuggestedParlay[] = [];

  // 1. "Safe Pick" — top 2-3 highest confidence model favorites
  const byConfidence = [...gamesWithPreds].sort(
    (a, b) => (b.prediction!.confidence) - (a.prediction!.confidence)
  );

  const safeLegs = byConfidence.slice(0, Math.min(2, byConfidence.length)).map((g) => {
    const pred = g.prediction!;
    return buildParlayLeg(g, pred.predicted_winner);
  });

  if (safeLegs.length >= 2) {
    const combinedProb = safeLegs.reduce((p, l) => p * l.modelProb, 1);
    const marketDecimalOdds = safeLegs.reduce((acc, l) => acc * probToDecimalOdds(l.marketProb), 1);
    const avgConf = safeLegs.reduce((s, l) => s + l.modelProb, 0) / safeLegs.length;
    suggestions.push({
      name: "Safe Pick",
      description: "Top model favorites — highest confidence plays",
      reasoning: [
        `Both picks have ${(avgConf * 100).toFixed(0)}%+ model confidence`,
        `Market and model agree on these favorites`,
        `${marketDecimalOdds.toFixed(1)}x payout with the highest win probability`,
      ],
      icon: <Shield size={18} />,
      color: "#34d399",
      bgGradient: "linear-gradient(135deg, rgba(52,211,153,0.1), rgba(16,185,129,0.05))",
      legs: safeLegs,
      combinedProb,
      marketDecimalOdds,
      americanOdds: decimalToAmericanOdds(marketDecimalOdds),
    });
  }

  // 2. "Edge Finder" — games where model disagrees with market
  const edgeGames = gamesWithPreds.filter((g) => {
    const pred = g.prediction!;
    const [t1, t2] = g.teams;
    const t1Lower = t1.name.toLowerCase();
    const homeLower = pred.home_team.toLowerCase();
    const isT1Home = t1Lower.includes(homeLower) || homeLower.includes(t1Lower);
    const modelFavIsT1 = isT1Home
      ? pred.home_win_probability > pred.away_win_probability
      : pred.away_win_probability > pred.home_win_probability;
    const marketFavIsT1 = t1.probability > t2.probability;
    return modelFavIsT1 !== marketFavIsT1;
  });

  if (edgeGames.length >= 2) {
    const edgeLegs = edgeGames.slice(0, 3).map((g) => {
      return buildParlayLeg(g, g.prediction!.predicted_winner);
    });
    const combinedProb = edgeLegs.reduce((p, l) => p * l.modelProb, 1);
    const marketDecimalOdds = edgeLegs.reduce((acc, l) => acc * probToDecimalOdds(l.marketProb), 1);
    suggestions.push({
      name: "Edge Finder",
      description: "Model disagrees with the market — value picks",
      reasoning: [
        `Model picks the market underdog in ${edgeLegs.length} game${edgeLegs.length > 1 ? "s" : ""}`,
        `Higher payout because market undervalues these teams`,
        `${((combinedProb / edgeLegs.reduce((p, l) => p * l.marketProb, 1) - 1) * 100).toFixed(0)}% model edge over implied odds`,
      ],
      icon: <Zap size={18} />,
      color: "#fb923c",
      bgGradient: "linear-gradient(135deg, rgba(251,146,60,0.1), rgba(249,115,22,0.05))",
      legs: edgeLegs,
      combinedProb,
      marketDecimalOdds,
      americanOdds: decimalToAmericanOdds(marketDecimalOdds),
    });
  }

  // 3. "Big Banger" — all today's model favorites for max payout
  if (gamesWithPreds.length >= 3) {
    const allFavLegs = gamesWithPreds.slice(0, 5).map((g) => {
      return buildParlayLeg(g, g.prediction!.predicted_winner);
    });
    const combinedProb = allFavLegs.reduce((p, l) => p * l.modelProb, 1);
    const marketDecimalOdds = allFavLegs.reduce((acc, l) => acc * probToDecimalOdds(l.marketProb), 1);
    suggestions.push({
      name: "Big Payout",
      description: `${allFavLegs.length}-leg parlay — all model favorites for max returns`,
      reasoning: [
        `${allFavLegs.length} legs multiply your potential payout to ${marketDecimalOdds.toFixed(1)}x`,
        `Every pick is the model's predicted winner`,
        `High risk but $100 returns $${(100 * marketDecimalOdds).toFixed(0)}`,
      ],
      icon: <Flame size={18} />,
      color: "#f43f5e",
      bgGradient: "linear-gradient(135deg, rgba(244,63,94,0.1), rgba(239,68,68,0.05))",
      legs: allFavLegs,
      combinedProb,
      marketDecimalOdds,
      americanOdds: decimalToAmericanOdds(marketDecimalOdds),
    });
  }

  // 4. "Chalk Play" — model AND market agree (safest possible)
  const chalkGames = gamesWithPreds.filter((g) => {
    const pred = g.prediction!;
    const [t1, t2] = g.teams;
    const t1Lower = t1.name.toLowerCase();
    const homeLower = pred.home_team.toLowerCase();
    const isT1Home = t1Lower.includes(homeLower) || homeLower.includes(t1Lower);
    const modelFavIsT1 = isT1Home
      ? pred.home_win_probability > pred.away_win_probability
      : pred.away_win_probability > pred.home_win_probability;
    const marketFavIsT1 = t1.probability > t2.probability;
    return modelFavIsT1 === marketFavIsT1 && pred.confidence > 0.55;
  });

  if (chalkGames.length >= 2) {
    const chalkLegs = chalkGames.slice(0, 3).map((g) => {
      return buildParlayLeg(g, g.prediction!.predicted_winner);
    });
    const combinedProb = chalkLegs.reduce((p, l) => p * l.modelProb, 1);
    const marketDecimalOdds = chalkLegs.reduce((acc, l) => acc * probToDecimalOdds(l.marketProb), 1);
    const avgConf = chalkLegs.reduce((s, l) => s + (l.game.prediction?.confidence || 0), 0) / chalkLegs.length;
    suggestions.push({
      name: "Chalk Play",
      description: "Model + market agree on favorites — consensus picks",
      reasoning: [
        `All picks are favored by both our AI and the market`,
        `Average model confidence: ${(avgConf * 100).toFixed(0)}%`,
        `Lowest variance option — these are the most likely to hit`,
      ],
      icon: <TrendingUp size={18} />,
      color: "#a78bfa",
      bgGradient: "linear-gradient(135deg, rgba(167,139,250,0.1), rgba(139,92,246,0.05))",
      legs: chalkLegs,
      combinedProb,
      marketDecimalOdds,
      americanOdds: decimalToAmericanOdds(marketDecimalOdds),
    });
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #a78bfa, #6366f1)" }}>
          <Layers size={14} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary tracking-tight">Suggested Parlays</h3>
          <p className="text-[11px] text-text-muted">AI-generated parlay ideas based on today&apos;s games</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onApplyParlay(s.legs)}
            className="suggested-parlay-card text-left group"
          >
            {/* Gradient accent */}
            <div className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: s.bgGradient }} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${s.color}18`, color: s.color }}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">{s.name}</p>
                    <p className="text-[10px] text-text-muted">{s.legs.length} legs</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
              </div>

              {/* Team logos row */}
              <div className="flex items-center gap-1.5 mb-3">
                {s.legs.map((leg, i) => {
                  const url = getTeamLogoUrl(leg.pickedTeam);
                  return url ? (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <img src={url} alt={leg.pickedTeam}
                        className="w-8 h-8 object-contain" />
                      <span className="text-[8px] font-bold" style={{ color: s.color }}>
                        {probToAmericanOdds(leg.marketProb)}
                      </span>
                    </div>
                  ) : (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
                        {leg.pickedTeam.charAt(0)}
                      </div>
                      <span className="text-[8px] font-bold" style={{ color: s.color }}>
                        {probToAmericanOdds(leg.marketProb)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reasoning */}
              <div className="space-y-1 mb-3">
                {s.reasoning.slice(0, 2).map((r, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <CheckCircle size={8} className="mt-0.5 flex-shrink-0" style={{ color: s.color }} />
                    <p className="text-[10px] text-text-muted leading-snug">{r}</p>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-muted">Odds</span>
                  <span className="text-xs font-black text-text-primary">
                    {s.americanOdds}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-muted">Pay</span>
                  <span className="text-xs font-black" style={{ color: s.color }}>
                    {s.marketDecimalOdds.toFixed(1)}x
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Brain size={8} className="text-emerald-400" />
                  <span className="text-xs font-bold" style={{ color: "#34d399" }}>
                    {(s.combinedProb * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
