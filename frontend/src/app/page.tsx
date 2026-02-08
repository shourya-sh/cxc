"use client";

import { useState, useEffect } from "react";
import {
  fetchAllNBA,
  fetchPredictions,
  NBAGame,
  NBAFuture,
} from "@/lib/api";
import GameCard from "@/components/GameCard";
import EventCard from "@/components/EventCard";
import EventModal from "@/components/EventModal";
import PromptBar from "@/components/PromptBar";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import AnalysisView from "@/components/AnalysisView";
import ParlayBuilder, { ParlayLeg } from "@/components/ParlayBuilder";
import SuggestedParlays from "@/components/SuggestedParlays";
import { RefreshCw, Zap, ExternalLink, Brain, BarChart3, Layers } from "lucide-react";

export default function Home() {
  const [games, setGames] = useState<NBAGame[]>([]);
  const [futures, setFutures] = useState<NBAFuture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFuture, setSelectedFuture] = useState<NBAFuture | null>(null);
  const [activeTab, setActiveTab] = useState<"games" | "futures" | "analysis">(
    "games"
  );
  const [modelAccuracy, setModelAccuracy] = useState<number | null>(null);
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);
  const [parlayOpen, setParlayOpen] = useState(false);

  /** Toggle a team pick for parlay — add, switch team, or remove */
  const handlePickTeam = (game: NBAGame, teamName: string) => {
    setParlayLegs((prev) => {
      const existing = prev.find((l) => l.game.id === game.id);
      if (existing && existing.pickedTeam === teamName) {
        // Same team clicked again → remove
        return prev.filter((l) => l.game.id !== game.id);
      }

      // Figure out model + market prob for the picked team
      const pred = game.prediction;
      const [t1, t2] = game.teams;
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
        // No model prediction — just use market odds
        marketProb = teamName === t1.name ? t1.probability : t2.probability;
        modelProb = marketProb;
      }

      const newLeg: ParlayLeg = { game, pickedTeam: teamName, modelProb, marketProb };

      if (existing) {
        // Switch team on same game
        return prev.map((l) => (l.game.id === game.id ? newLeg : l));
      }
      // Add new leg
      return [...prev, newLeg];
    });

    // Auto-open the panel when first pick is made
    setParlayOpen(true);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch Polymarket data and predictions in parallel
      const [nbaData, predData] = await Promise.all([
        fetchAllNBA(),
        fetchPredictions().catch(() => null),
      ]);

      // If predictions loaded, merge them into games
      if (predData?.games) {
        // Build a map of game_id -> prediction
        const predMap = new Map<string, NBAGame>();
        for (const g of predData.games) {
          predMap.set(g.id, g);
        }
        // Merge predictions into Polymarket games
        const mergedGames = nbaData.games.map((game) => {
          const withPred = predMap.get(game.id);
          return {
            ...game,
            prediction: withPred?.prediction ?? null,
          };
        });
        setGames(mergedGames);
        setModelAccuracy(predData.model_accuracy);
      } else {
        setGames(nbaData.games);
      }

      setFutures(nbaData.futures);
    } catch (err: any) {
      setError(
        err.message?.includes("API error")
          ? "Backend not connected. Start the FastAPI server on port 8000."
          : "Failed to load events."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalVolume = [...games, ...futures].reduce(
    (s, e) => s + e.volume,
    0
  );
  const gamesWithPredictions = games.filter((g) => g.prediction).length;

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <Zap size={18} className="text-bg-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CXC</h1>
              <p className="text-xs text-text-muted">
                NBA Betting Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-bg-elevated border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-light transition-all disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <a
              href="https://polymarket.com/sports/nba/games"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-elevated border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-light transition-all"
            >
              Polymarket
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* AI Prompt Bar */}
        <div className="mb-6">
          <PromptBar />
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && activeTab !== "analysis" && <LoadingSkeleton count={9} />}

      {/* Main content */}
      {!loading && !error && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#fb923c18" }}
              >
                <span className="text-sm" style={{ color: "#fb923c" }}>
                  🏀
                </span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Games</p>
                <p className="text-base font-bold text-text-primary">
                  {games.length}
                </p>
              </div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#a78bfa18" }}
              >
                <span className="text-sm" style={{ color: "#a78bfa" }}>
                  🏆
                </span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Futures</p>
                <p className="text-base font-bold text-text-primary">
                  {futures.length}
                </p>
              </div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#34d39918" }}
              >
                <span className="text-sm" style={{ color: "#34d399" }}>
                  💰
                </span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Volume</p>
                <p className="text-base font-bold text-text-primary">
                  $
                  {totalVolume >= 1_000_000
                    ? `${(totalVolume / 1_000_000).toFixed(1)}M`
                    : `${(totalVolume / 1_000).toFixed(0)}K`}
                </p>
              </div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#22d3ee18" }}
              >
                <Brain size={16} style={{ color: "#22d3ee" }} />
              </div>
              <div>
                <p className="text-xs text-text-muted">Model Accuracy</p>
                <p className="text-base font-bold text-text-primary">
                  {modelAccuracy
                    ? `${(modelAccuracy * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => setActiveTab("games")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "games"
                  ? "bg-accent text-bg-primary"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              Games ({games.length})
              {gamesWithPredictions > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                  style={{
                    background:
                      activeTab === "games"
                        ? "rgba(0,0,0,0.2)"
                        : "rgba(34,211,238,0.15)",
                    color:
                      activeTab === "games" ? "rgba(0,0,0,0.6)" : "#22d3ee",
                  }}
                >
                  <Brain size={8} className="inline mr-0.5" />
                  {gamesWithPredictions}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("futures")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "futures"
                  ? "bg-accent text-bg-primary"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              Futures ({futures.length})
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "analysis"
                  ? "bg-accent text-bg-primary"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              <BarChart3 size={13} />
              Analysis
            </button>
          </div>

          {/* Games grid */}
          {activeTab === "games" && (
            <>
              {/* Suggested Parlays */}
              {gamesWithPredictions > 1 && (
                <SuggestedParlays
                  games={games}
                  onApplyParlay={(legs: ParlayLeg[]) => {
                    setParlayLegs(legs);
                    setParlayOpen(true);
                  }}
                />
              )}

              {gamesWithPredictions > 0 && (
                <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-accent/5 to-transparent border border-accent/10 flex items-center gap-3">
                  <Brain size={18} className="text-accent flex-shrink-0" />
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Each card shows two bars:{" "}
                    <span className="text-text-primary font-semibold">Market</span>{" "}
                    (Polymarket odds) and{" "}
                    <span className="text-text-primary font-semibold">AI Model</span>{" "}
                    (our ML prediction). Click a team logo to add to your parlay.{" "}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>
                      <Zap size={8} /> EDGE
                    </span>{" "}
                    = model disagrees with the market.
                  </p>
                </div>
              )}
              {games.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {games.map((game, i) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      index={i}
                      onPickTeam={handlePickTeam}
                      parlayPickedTeam={parlayLegs.find((l) => l.game.id === game.id)?.pickedTeam ?? null}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-text-muted text-sm">
                    No NBA games found on Polymarket right now.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Futures grid */}
          {activeTab === "futures" && (
            <>
              {futures.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {futures.map((ev, i) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      index={i}
                      onClick={setSelectedFuture}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-text-muted text-sm">
                    No NBA futures found.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Analysis view */}
          {activeTab === "analysis" && <AnalysisView />}

          {selectedFuture && (
            <EventModal
              event={selectedFuture}
              onClose={() => setSelectedFuture(null)}
            />
          )}

          {/* Footer */}
          <footer className="mt-12 pb-8 text-center">
            <p className="text-xs text-text-muted">
              Live NBA data from{" "}
              <a
                href="https://polymarket.com/sports/nba/games"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Polymarket
              </a>{" "}
              &middot; ML predictions by CXC Model (
              {modelAccuracy
                ? `${(modelAccuracy * 100).toFixed(1)}%`
                : "loading"}
              ) &middot; {games.length} games &middot; {futures.length} futures
            </p>
          </footer>
        </>
      )}

      {/* Parlay Builder */}
      <ParlayBuilder
        legs={parlayLegs}
        onRemoveLeg={(gameId) => setParlayLegs((prev) => prev.filter((l) => l.game.id !== gameId))}
        onClear={() => setParlayLegs([])}
        isOpen={parlayOpen}
        onToggle={() => setParlayOpen((o) => !o)}
      />
    </div>
  );
}
