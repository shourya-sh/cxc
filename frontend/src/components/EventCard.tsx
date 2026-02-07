"use client";

import { PolymarketEvent } from "@/lib/api";
import DonutChart from "./DonutChart";
import ProbabilityBars from "./ProbabilityBars";
import { TrendingUp, Clock, BarChart3 } from "lucide-react";

interface EventCardProps {
  event: PolymarketEvent;
  index: number;
  onClick?: (event: PolymarketEvent) => void;
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

// Category color mapping
const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  NBA: { bg: "rgba(251, 146, 60, 0.14)", text: "#fb923c" },
  NFL: { bg: "rgba(96, 165, 250, 0.14)", text: "#60a5fa" },
  MLB: { bg: "rgba(52, 211, 153, 0.14)", text: "#34d399" },
  NHL: { bg: "rgba(34, 211, 238, 0.14)", text: "#22d3ee" },
  EPL: { bg: "rgba(167, 139, 250, 0.14)", text: "#a78bfa" },
  UCL: { bg: "rgba(244, 114, 182, 0.14)", text: "#f472b6" },
  FIFA: { bg: "rgba(163, 230, 53, 0.14)", text: "#a3e635" },
  F1: { bg: "rgba(248, 113, 113, 0.14)", text: "#f87171" },
  UFC: { bg: "rgba(251, 191, 36, 0.14)", text: "#fbbf24" },
  Tennis: { bg: "rgba(129, 140, 248, 0.14)", text: "#818cf8" },
  Award: { bg: "rgba(232, 121, 249, 0.14)", text: "#e879f9" },
};

const DEFAULT_CAT = { bg: "rgba(161, 161, 170, 0.14)", text: "#a1a1aa" };

export default function EventCard({ event, index, onClick }: EventCardProps) {
  const catStyle = CAT_COLORS[event.category] || DEFAULT_CAT;
  const hasMultipleCharts = event.outcomes.length > 2;

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={() => onClick && onClick(event)}
      className="glass-card p-5 fade-in flex flex-col cursor-pointer hover:scale-[1.01] transition-transform"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {/* Event image */}
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
              style={{ background: catStyle.bg, color: catStyle.text }}
            >
              {event.category}
            </span>
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <BarChart3 size={10} />
              {event.markets_count} market{event.markets_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Chart + Bars section */}
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
