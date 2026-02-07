"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchEvents, searchEvents, PolymarketEvent } from "@/lib/api";
import EventCard from "@/components/EventCard";
import EventModal from "@/components/EventModal";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import StatsRow from "@/components/StatsRow";
import { RefreshCw, Zap, ExternalLink } from "lucide-react";

const SORT_OPTIONS = [
  { label: "Volume", value: "volume" },
  { label: "Ending Soon", value: "end_date" },
  { label: "Markets", value: "markets" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export default function Home() {
  const [events, setEvents] = useState<PolymarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("volume");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PolymarketEvent | null>(null);

  const loadEvents = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      let data: PolymarketEvent[];
      if (query) {
        data = await searchEvents(query);
        setSearchQuery(query);
      } else {
        data = await fetchEvents();
        setSearchQuery(null);
      }
      setEvents(data);
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
    loadEvents();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadEvents(searchQuery || undefined);
    setRefreshing(false);
  };

  // Derived data
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [events]);

  const categories = useMemo(
    () =>
      Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k),
    [categoryCounts]
  );

  const filtered = useMemo(() => {
    let list =
      activeCategory === "all"
        ? events
        : events.filter((e) => e.category === activeCategory);

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === "volume") return b.volume - a.volume;
      if (sortBy === "markets") return b.markets_count - a.markets_count;
      if (sortBy === "end_date") {
        const da = a.end_date ? new Date(a.end_date).getTime() : Infinity;
        const db = b.end_date ? new Date(b.end_date).getTime() : Infinity;
        return da - db;
      }
      return 0;
    });

    return list;
  }, [events, activeCategory, sortBy]);

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
                Sports Betting Intelligence
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
              href="https://polymarket.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-elevated border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-light transition-all"
            >
              Polymarket
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Search */}
        <div className="flex justify-center mb-6">
          <SearchBar onSearch={(q) => loadEvents(q)} isLoading={loading} />
        </div>

        {/* Search result indicator */}
        {searchQuery && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-text-secondary">
              Results for &ldquo;{searchQuery}&rdquo;
            </span>
            <button
              onClick={() => loadEvents()}
              className="text-xs text-accent hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </header>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSkeleton count={9} />}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Stats row */}
          <StatsRow events={events} />

          {/* Filters row */}
          <div className="flex items-center justify-between mt-6 mb-5 gap-4 flex-wrap">
            <CategoryFilter
              categories={categories}
              active={activeCategory}
              onSelect={setActiveCategory}
              counts={categoryCounts}
            />

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Sort:</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                    sortBy === opt.value
                      ? "bg-bg-hover text-text-primary font-medium"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} onClick={setSelectedEvent} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-text-muted text-sm">
                No events found
                {activeCategory !== "all"
                  ? ` in ${activeCategory}`
                  : searchQuery
                  ? ` for "${searchQuery}"`
                  : ""}
                .
              </p>
            </div>
          )}

          {selectedEvent && (
            <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          )}

          {/* Footer */}
          <footer className="mt-12 pb-8 text-center">
            <p className="text-xs text-text-muted">
              Live data from{" "}
              <a
                href="https://polymarket.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Polymarket
              </a>{" "}
              &middot; {events.length} events &middot; Updated in real-time
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
