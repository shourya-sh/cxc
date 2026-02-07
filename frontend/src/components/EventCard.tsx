"use client";

import { NBAFuture } from "@/lib/api";
import DonutChart from "./DonutChart";
import ProbabilityBars from "./ProbabilityBars";
import { TrendingUp, Clock, BarChart3 } from "lucide-react";

interface EventCardProps {
  event: NBAFuture;
  index: number;
  onClick?: (event: NBAFuture) => void;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Open";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EventCard({ event, index, onClick }: EventCardProps) {
  const hasMultipleCharts = event.outcomes.length > 2;

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={() => onClick?.(event)}
      className="glass-card p-5 fade-in flex flex-col cursor-pointer hover:scale-[1.01] transition-transform"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {event.image && (
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elevated">
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
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary leading-tight line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="cat-pill"
              style={{ background: "rgba(251, 146, 60, 0.14)", color: "#fb923c" }}
            >
              NBA
            </span>
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <BarChart3 size={10} />
              {event.markets_count} market{event.markets_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Chart + Bars */}
      <div className="flex-1">
        {hasMultipleCharts ? (
          <div className="flex gap-4 items-start">
            <DonutChart outcomes={event.outcomes} size={88} />
            <div className="flex-1 min-w-0">
              <ProbabilityBars outcomes={event.outcomes} maxItems={4} />
            </div>
          </div>
        ) : (
          <ProbabilityBars outcomes={event.outcomes} maxItems={5} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-text-muted">
          <TrendingUp size={12} />
          <span className="text-xs font-medium">{formatVolume(event.volume)}</span>
          <span className="text-[10px] text-text-muted ml-0.5">vol</span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <Clock size={12} />
          <span className="text-xs">{formatDate(event.end_date)}</span>
        </div>
      </div>
    </div>
  );
}
