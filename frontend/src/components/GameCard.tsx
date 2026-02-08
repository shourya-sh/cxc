"use client";

import { NBAGame } from "@/lib/api";
import { Clock, TrendingUp, Brain, Zap, Target } from "lucide-react";

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

/** NBA team primary color */
const TEAM_COLORS: Record<string, string> = {
  hawks: "#E03A3E", celtics: "#007A33", nets: "#FFFFFF",
  hornets: "#1D1160", bulls: "#CE1141", cavaliers: "#860038",
  mavericks: "#00538C", nuggets: "#0E2240", pistons: "#C8102E",
  warriors: "#1D428A", rockets: "#CE1141", pacers: "#002D62",
  clippers: "#C8102E", lakers: "#552583", grizzlies: "#5D76A9",
  heat: "#98002E", bucks: "#00471B", timberwolves: "#0C2340",
  pelicans: "#0C2340", knicks: "#006BB6", thunder: "#007AC1",
  magic: "#0077C0", "76ers": "#006BB6", suns: "#1D1160",
  "trail blazers": "#E03A3E", blazers: "#E03A3E",
  kings: "#5A2D81", spurs: "#C4CED4", raptors: "#CE1141",
  jazz: "#002B5C", wizards: "#002B5C",
};

function getTeamLogoUrl(name: string): string | null {
  const key = name.trim().toLowerCase();
  const id = TEAM_LOGO_ID[key];
  if (!id) return null;
  return `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg`;
}

function getTeamColor(name: string): string {
  const key = name.trim().toLowerCase();
  return TEAM_COLORS[key] || "#a78bfa";
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
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

/** Convert probability (0-1) to decimal odds */
function probToDecimalOdds(prob: number): number {
  if (prob <= 0.01) return 100;
  return 1 / prob;
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
  let score = 0;
  score += modelConf * 40;
  score += Math.abs(modelFavPct - 50) * 0.8;
  if (agrees) score += 15;
  score += Math.min(polyFavPct, 90) * 0.05;
  if (modelConf > 0.72) score += 8;
  if (modelConf > 0.65 && agrees) score += 5;
  if (Math.abs(modelFavPct - polyFavPct * 100) > 15) score -= 8;

  if (score >= 62) return { grade: "A+", color: "#22c55e", bg: "rgba(34,197,94,0.15)", label: "Strong Bet" };
  if (score >= 54) return { grade: "A",  color: "#34d399", bg: "rgba(52,211,153,0.15)", label: "Great Value" };
  if (score >= 46) return { grade: "B+", color: "#60a5fa", bg: "rgba(96,165,250,0.15)", label: "Good Play" };
  if (score >= 38) return { grade: "B",  color: "#818cf8", bg: "rgba(129,140,248,0.15)", label: "Solid" };
  if (score >= 30) return { grade: "C+", color: "#a78bfa", bg: "rgba(167,139,250,0.15)", label: "Moderate" };
  if (score >= 22) return { grade: "C",  color: "#fbbf24", bg: "rgba(251,191,36,0.15)", label: "Risky" };
  if (score >= 14) return { grade: "D",  color: "#f97316", bg: "rgba(249,115,22,0.15)", label: "High Risk" };
  return                  { grade: "F",  color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Avoid" };
}

export default function GameCard({ game, index, onClick, onPickTeam, parlayPickedTeam }: GameCardProps) {
  const [team1, team2] = game.teams;
  if (!team1 || !team2) return null;

  const pred = game.prediction;
  const isLive = formatGameDate(game.game_date) === "Live";

  let team1ModelPct: number | null = null;
  let team2ModelPct: number | null = null;
  let team1Score: number | null = null;
  let team2Score: number | null = null;
  let isEdge = false;

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
    } else {
      team1ModelPct = awayWinPct;
      team2ModelPct = homeWinPct;
      team1Score = pred.predicted_away_score ?? null;
      team2Score = pred.predicted_home_score ?? null;
    }

    const polyFav = team1.probability > team2.probability ? 1 : 2;
    const modelFav = team1ModelPct > team2ModelPct ? 1 : 2;
    isEdge = polyFav !== modelFav;
  }

  const betGrade = pred && team1ModelPct !== null
    ? getBetGrade(
        pred.confidence,
        Math.max(team1ModelPct, team2ModelPct!),
        Math.max(team1.probability, team2.probability),
        !isEdge
      )
    : null;

  const team1Color = getTeamColor(team1.name);
  const team2Color = getTeamColor(team2.name);

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={() => onClick?.(game)}
      className="game-card-container fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Ambient glow from team colors */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full blur-[80px] opacity-[0.08]"
          style={{ background: team1Color }} />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full blur-[80px] opacity-[0.08]"
          style={{ background: team2Color }} />
      </div>

      {/* Top bar: date + badges */}
      <div className="relative flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.15)" }}>
              <div className="live-dot" />
              <span className="text-xs font-bold" style={{ color: "#34d399" }}>LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-text-muted">
              <Clock size={13} />
              <span className="text-xs font-medium">{formatGameDate(game.game_date)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pred && isEdge && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>
              <Zap size={10} /> EDGE
            </span>
          )}
          {betGrade && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: betGrade.bg, border: `1px solid ${betGrade.color}30` }}>
              <span className="text-sm font-black" style={{ color: betGrade.color }}>
                {betGrade.grade}
              </span>
              <span className="text-[10px] font-semibold hidden sm:inline" style={{ color: betGrade.color }}>
                {betGrade.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ======== MATCHUP CENTER ======== */}
      <div className="relative flex items-center justify-between px-2 mb-6">
        {/* Team 1 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPickTeam?.(game, team1.name); }}
          className={`team-logo-btn flex flex-col items-center gap-3 flex-1 py-3 rounded-2xl transition-all ${
            parlayPickedTeam === team1.name
              ? "ring-2 ring-accent bg-accent/10 scale-[1.03]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          <div className="relative">
            {getTeamLogoUrl(team1.name) ? (
              <img src={getTeamLogoUrl(team1.name)!} alt={team1.name}
                className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-lg team-logo" />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-bg-elevated flex items-center justify-center">
                <span className="text-2xl font-black text-text-muted">{team1.name.charAt(0)}</span>
              </div>
            )}
            {parlayPickedTeam === team1.name && (
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-lg">
                <Target size={12} className="text-bg-primary" />
              </div>
            )}
          </div>
          <p className="text-sm md:text-base font-bold text-text-primary text-center">{team1.name}</p>
          {/* Moneyline odds */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
              {probToAmericanOdds(team1.probability)}
            </span>
            {team1ModelPct !== null && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                {probToAmericanOdds(team1ModelPct / 100)}
              </span>
            )}
          </div>
        </button>

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1 px-3 flex-shrink-0">
          {team1Score !== null && team2Score !== null ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl md:text-3xl font-black text-text-primary">{team1Score}</span>
                <span className="text-sm text-text-muted font-medium">-</span>
                <span className="text-2xl md:text-3xl font-black text-text-primary">{team2Score}</span>
              </div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Predicted</span>
            </>
          ) : (
            <span className="text-lg font-black text-text-muted/40">VS</span>
          )}
        </div>

        {/* Team 2 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPickTeam?.(game, team2.name); }}
          className={`team-logo-btn flex flex-col items-center gap-3 flex-1 py-3 rounded-2xl transition-all ${
            parlayPickedTeam === team2.name
              ? "ring-2 ring-accent bg-accent/10 scale-[1.03]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          <div className="relative">
            {getTeamLogoUrl(team2.name) ? (
              <img src={getTeamLogoUrl(team2.name)!} alt={team2.name}
                className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-lg team-logo" />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-bg-elevated flex items-center justify-center">
                <span className="text-2xl font-black text-text-muted">{team2.name.charAt(0)}</span>
              </div>
            )}
            {parlayPickedTeam === team2.name && (
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-lg">
                <Target size={12} className="text-bg-primary" />
              </div>
            )}
          </div>
          <p className="text-sm md:text-base font-bold text-text-primary text-center">{team2.name}</p>
          {/* Moneyline odds */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
              {probToAmericanOdds(team2.probability)}
            </span>
            {team2ModelPct !== null && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                {probToAmericanOdds(team2ModelPct / 100)}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* ======== ODDS / MODEL SECTION ======== */}
      <div className="relative space-y-3 px-1">
        {/* Polymarket odds bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-lg font-extrabold" style={{ color: "#a78bfa" }}>
              {(team1.probability * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] text-text-muted tracking-widest uppercase font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#a78bfa" }} />
              Market
            </span>
            <span className="text-lg font-extrabold" style={{ color: "#60a5fa" }}>
              {(team2.probability * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-bg-elevated overflow-hidden flex">
            <div className="h-full transition-all duration-700 rounded-l-full"
              style={{ width: `${team1.probability * 100}%`, background: "linear-gradient(90deg, #a78bfa, #8b5cf6)" }} />
            <div className="h-full transition-all duration-700 rounded-r-full"
              style={{ width: `${team2.probability * 100}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }} />
          </div>
        </div>

        {/* Model prediction bar */}
        {team1ModelPct !== null && team2ModelPct !== null && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-lg font-extrabold" style={{ color: "#34d399" }}>
                {team1ModelPct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-text-muted tracking-widest uppercase font-semibold flex items-center gap-1.5">
                <Brain size={10} className="text-emerald-400" />
                AI Model
              </span>
              <span className="text-lg font-extrabold" style={{ color: "#22d3ee" }}>
                {team2ModelPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-bg-elevated overflow-hidden flex">
              <div className="h-full transition-all duration-700 rounded-l-full"
                style={{ width: `${team1ModelPct}%`, background: "linear-gradient(90deg, #34d399, #10b981)" }} />
              <div className="h-full transition-all duration-700 rounded-r-full"
                style={{ width: `${team2ModelPct}%`, background: "linear-gradient(90deg, #06b6d4, #22d3ee)" }} />
            </div>
          </div>
        )}
      </div>

      {/* ======== FOOTER ======== */}
      <div className="relative flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06] px-1">
        <div className="flex items-center gap-2 text-text-muted">
          <TrendingUp size={13} />
          <span className="text-xs font-semibold">{formatVolume(game.volume)}</span>
          <span className="text-[10px] text-text-muted/60">volume</span>
        </div>
        <div className="flex items-center gap-3">
          {pred && pred.predicted_home_score != null && pred.predicted_away_score != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-medium">O/U</span>
              <span className="text-[11px] font-bold text-text-primary">
                {pred.predicted_total ?? (pred.predicted_home_score + pred.predicted_away_score)}
              </span>
            </div>
          )}
          {pred ? (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }} />
              <span className="text-[11px] text-text-muted font-medium">
                {(pred.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-text-muted/60 font-medium">Polymarket</span>
          )}
        </div>
      </div>
    </div>
  );
}
