"use client";

import { NBAGame } from "@/lib/api";
import { Clock, TrendingUp, Brain } from "lucide-react";

interface GameCardProps {
  game: NBAGame;
  index: number;
  onClick?: (game: NBAGame) => void;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatGameDate(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return "Live";
  if (diffHours < 24) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function GameCard({ game, index, onClick }: GameCardProps) {
  const [team1, team2] = game.teams;
  if (!team1 || !team2) return null;

  const pred = game.prediction;

  // Match model prediction to correct Polymarket team
  let team1ModelPct: number | null = null;
  let team2ModelPct: number | null = null;
  let isEdge = false;

  if (pred) {
    const t1Lower = team1.name.toLowerCase();
    const homeLower = pred.home_team.toLowerCase();
    const homeWinPct = pred.home_win_probability * 100;
    const awayWinPct = pred.away_win_probability * 100;

    if (t1Lower.includes(homeLower) || homeLower.includes(t1Lower)) {
      team1ModelPct = homeWinPct;
      team2ModelPct = awayWinPct;
    } else {
      team1ModelPct = awayWinPct;
      team2ModelPct = homeWinPct;
    }

    const polyFav = team1.probability > team2.probability ? 1 : 2;
    const modelFav = team1ModelPct > team2ModelPct ? 1 : 2;
    isEdge = polyFav !== modelFav;
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={() => onClick?.(game)}
      className="glass-card p-5 fade-in cursor-pointer hover:scale-[1.01] transition-transform"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Clock size={12} />
          <span className="text-xs font-medium">{formatGameDate(game.game_date)}</span>
        </div>
        <div className="flex items-center gap-2">
          {pred && isEdge && (
            <span
              className="cat-pill flex items-center gap-1"
              style={{ background: "rgba(251, 146, 60, 0.14)", color: "#fb923c" }}
            >
              Edge
            </span>
          )}
          <span className="cat-pill" style={{ background: "rgba(251, 146, 60, 0.14)", color: "#fb923c" }}>
            NBA
          </span>
        </div>
      </div>

      {/* Team names row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-text-primary">{team1.name}</p>
        <span className="text-[10px] text-text-muted">VS</span>
        <p className="text-sm font-semibold text-text-primary">{team2.name}</p>
      </div>

      {/* Polymarket odds row */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg font-bold" style={{ color: "#a78bfa" }}>
            {(team1.probability * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-text-muted tracking-wide uppercase">Polymarket</span>
          <span className="text-lg font-bold" style={{ color: "#60a5fa" }}>
            {(team2.probability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg-elevated overflow-hidden flex">
          <div
            className="h-full rounded-l-full"
            style={{ width: `${team1.probability * 100}%`, background: "#a78bfa" }}
          />
          <div
            className="h-full rounded-r-full"
            style={{ width: `${team2.probability * 100}%`, background: "#60a5fa" }}
          />
        </div>
      </div>

      {/* Model prediction row */}
      {team1ModelPct !== null && team2ModelPct !== null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-lg font-bold" style={{ color: "#34d399" }}>
              {team1ModelPct.toFixed(0)}%
            </span>
            <span className="text-[10px] text-text-muted tracking-wide uppercase flex items-center gap-1">
              <Brain size={9} /> Our Model
            </span>
            <span className="text-lg font-bold" style={{ color: "#34d399" }}>
              {team2ModelPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden flex">
            <div
              className="h-full rounded-l-full"
              style={{ width: `${team1ModelPct}%`, background: "#34d399" }}
            />
            <div
              className="h-full rounded-r-full"
              style={{ width: `${team2ModelPct}%`, background: "#34d39966" }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-text-muted">
          <TrendingUp size={12} />
          <span className="text-xs font-medium">{formatVolume(game.volume)}</span>
          <span className="text-[10px] text-text-muted ml-0.5">vol</span>
        </div>
        {pred ? (
          <span className="text-[10px] text-text-muted">
            {(pred.confidence * 100).toFixed(0)}% model conf
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">Polymarket</span>
        )}
      </div>
    </div>
  );
}
