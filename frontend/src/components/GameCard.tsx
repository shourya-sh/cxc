"use client";

import { NBAGame } from "@/lib/api";
import { Clock, TrendingUp, Brain } from "lucide-react";

interface GameCardProps {
  game: NBAGame;
  index: number;
  onClick?: (game: NBAGame) => void;
  onPickTeam?: (game: NBAGame, teamName: string) => void;
  parlayPickedTeam?: string | null;
}

/** NBA team name → team ID for logo CDN */
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

/** Compute a bet grade from model confidence + market agreement */
function getBetGrade(
  modelConf: number,
  modelFavPct: number,
  polyFavPct: number,
  agrees: boolean
): { grade: string; color: string; bg: string; label: string } {
  // Score 0–100 based on: confidence, model certainty, market alignment
  let score = 0;
  score += modelConf * 40;                         // 0-40 from raw confidence
  score += Math.abs(modelFavPct - 50) * 0.8;       // 0-40 from how decisive the model is
  if (agrees) score += 15;                          // +15 if model & market agree
  score += Math.min(polyFavPct, 90) * 0.05;         // tiny bonus for strong market signal

  // Add a little spread so we get more variety
  if (modelConf > 0.72) score += 8;
  if (modelConf > 0.65 && agrees) score += 5;
  if (Math.abs(modelFavPct - polyFavPct * 100) > 15) score -= 8; // big disagreement = riskier

  if (score >= 62) return { grade: "A+", color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Strong Bet" };
  if (score >= 54) return { grade: "A",  color: "#34d399", bg: "rgba(52,211,153,0.12)", label: "Great Value" };
  if (score >= 46) return { grade: "B+", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", label: "Good Play" };
  if (score >= 38) return { grade: "B",  color: "#818cf8", bg: "rgba(129,140,248,0.12)", label: "Solid" };
  if (score >= 30) return { grade: "C+", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Moderate" };
  if (score >= 22) return { grade: "C",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "Risky" };
  if (score >= 14) return { grade: "D",  color: "#f97316", bg: "rgba(249,115,22,0.12)", label: "High Risk" };
  return                  { grade: "F",  color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Avoid" };
}

export default function GameCard({ game, index, onClick, onPickTeam, parlayPickedTeam }: GameCardProps) {
  const [team1, team2] = game.teams;
  if (!team1 || !team2) return null;

  const pred = game.prediction;

  // Match model prediction to correct Polymarket team
  let team1ModelPct: number | null = null;
  let team2ModelPct: number | null = null;
  let team1Score: number | null = null;
  let team2Score: number | null = null;
  let isEdge = false;
  let isTeam1Home = true;

  if (pred) {
    const t1Lower = team1.name.toLowerCase();
    const homeLower = pred.home_team.toLowerCase();
    const homeWinPct = pred.home_win_probability * 100;
    const awayWinPct = pred.away_win_probability * 100;

    if (t1Lower.includes(homeLower) || homeLower.includes(t1Lower)) {
      team1ModelPct = homeWinPct;
      team2ModelPct = awayWinPct;
      team1Score = pred.predicted_home_score ?? null;
      team2Score = pred.predicted_away_score ?? null;
      isTeam1Home = true;
    } else {
      team1ModelPct = awayWinPct;
      team2ModelPct = homeWinPct;
      team1Score = pred.predicted_away_score ?? null;
      team2Score = pred.predicted_home_score ?? null;
      isTeam1Home = false;
    }

    const polyFav = team1.probability > team2.probability ? 1 : 2;
    const modelFav = team1ModelPct > team2ModelPct ? 1 : 2;
    isEdge = polyFav !== modelFav;
  }

  // Compute bet grade
  const betGrade = pred && team1ModelPct !== null
    ? getBetGrade(
        pred.confidence,
        Math.max(team1ModelPct, team2ModelPct!),
        Math.max(team1.probability, team2.probability),
        !isEdge
      )
    : null;

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={() => onClick?.(game)}
      className="glass-card p-5 fade-in cursor-pointer hover:scale-[1.01] transition-transform relative overflow-hidden"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Bet Grade — top-right corner */}
      {betGrade && (
        <div className="absolute top-0 right-0 flex flex-col items-center pt-2.5 pr-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: betGrade.bg, border: `1.5px solid ${betGrade.color}30` }}
          >
            <span className="text-xl font-black" style={{ color: betGrade.color }}>
              {betGrade.grade}
            </span>
          </div>
          <span className="text-[9px] font-semibold mt-0.5 tracking-wide" style={{ color: betGrade.color }}>
            {betGrade.label}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Clock size={12} />
          <span className="text-xs font-medium">{formatGameDate(game.game_date)}</span>
        </div>
        <div className="flex items-center gap-2 mr-14">
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

      {/* Team names row with logos — clickable for parlay */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPickTeam?.(game, team1.name);
          }}
          className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
            parlayPickedTeam === team1.name
              ? "ring-2 ring-accent bg-accent/10"
              : "hover:bg-bg-elevated"
          }`}
        >
          {getTeamLogoUrl(team1.name) && (
            <img src={getTeamLogoUrl(team1.name)!} alt={team1.name} className="w-7 h-7 object-contain" />
          )}
          <p className="text-sm font-semibold text-text-primary">{team1.name}</p>
        </button>
        <span className="text-[10px] text-text-muted">VS</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPickTeam?.(game, team2.name);
          }}
          className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
            parlayPickedTeam === team2.name
              ? "ring-2 ring-accent bg-accent/10"
              : "hover:bg-bg-elevated"
          }`}
        >
          <p className="text-sm font-semibold text-text-primary">{team2.name}</p>
          {getTeamLogoUrl(team2.name) && (
            <img src={getTeamLogoUrl(team2.name)!} alt={team2.name} className="w-7 h-7 object-contain" />
          )}
        </button>
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

      {/* Predicted Score */}
      {team1Score !== null && team2Score !== null && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="text-xl font-bold text-text-primary">{team1Score}</span>
          <span className="text-xs text-text-muted font-medium tracking-wider">-</span>
          <span className="text-xl font-bold text-text-primary">{team2Score}</span>
          <span className="text-[10px] text-text-muted ml-1">predicted</span>
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
