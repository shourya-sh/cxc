"use client";

import { NBAFuture } from "@/lib/api";
import ProbabilityBars from "./ProbabilityBars";
import DonutChart from "./DonutChart";
import { X, ExternalLink, TrendingUp, Clock, BarChart3, DollarSign } from "lucide-react";

interface EventModalProps {
  event: NBAFuture | null;
  onClose: () => void;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;

  const hasMultiOutcomes = event.outcomes.length > 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-[80vw] max-w-[900px] z-10">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-2xl" />
        <div className="relative z-20 w-full bg-bg-card/70 border border-border rounded-2xl p-6 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {event.image && (
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elevated">
                  <img
                    src={event.image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">{event.title}</h3>
                <p className="text-sm text-text-muted mt-1">
                  {event.category} &middot; {event.markets_count} market{event.markets_count !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`https://polymarket.com/event/${event.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 text-xs text-text-muted bg-bg-elevated rounded-md flex items-center gap-2 hover:text-text-primary transition-colors"
              >
                <ExternalLink size={14} />
                Polymarket
              </a>
              <button
                className="px-3 py-2 rounded-md bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
                onClick={onClose}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div className="bg-bg-elevated rounded-lg px-3 py-2.5 flex items-center gap-2">
              <TrendingUp size={14} className="text-[#a78bfa]" />
              <div>
                <p className="text-[10px] text-text-muted">Volume</p>
                <p className="text-sm font-semibold">{formatVolume(event.volume)}</p>
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2.5 flex items-center gap-2">
              <DollarSign size={14} className="text-[#34d399]" />
              <div>
                <p className="text-[10px] text-text-muted">Liquidity</p>
                <p className="text-sm font-semibold">{formatVolume(event.liquidity)}</p>
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2.5 flex items-center gap-2">
              <BarChart3 size={14} className="text-[#60a5fa]" />
              <div>
                <p className="text-[10px] text-text-muted">Markets</p>
                <p className="text-sm font-semibold">{event.markets_count}</p>
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2.5 flex items-center gap-2">
              <Clock size={14} className="text-[#fbbf24]" />
              <div>
                <p className="text-[10px] text-text-muted">Ends</p>
                <p className="text-sm font-semibold">
                  {event.end_date
                    ? new Date(event.end_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Open"}
                </p>
              </div>
            </div>
          </div>

          {/* Outcomes */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Chart */}
            {hasMultiOutcomes && (
              <div className="lg:col-span-1 flex items-center justify-center">
                <DonutChart outcomes={event.outcomes} size={160} />
              </div>
            )}

            {/* Probability bars */}
            <div className={hasMultiOutcomes ? "lg:col-span-2" : "lg:col-span-3"}>
              <p className="text-xs text-text-muted mb-3">
                Outcomes ({event.outcomes.length})
              </p>
              <ProbabilityBars
                outcomes={event.outcomes}
                maxItems={event.outcomes.length > 10 ? 10 : event.outcomes.length}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Probabilities from Polymarket implied odds
            </p>
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              polymarket.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
