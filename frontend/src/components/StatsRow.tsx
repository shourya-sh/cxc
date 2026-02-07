"use client";

import { PolymarketEvent } from "@/lib/api";
import { TrendingUp, DollarSign, Trophy, BarChart3 } from "lucide-react";

interface StatsRowProps {
  events: PolymarketEvent[];
}

function formatBig(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function StatsRow({ events }: StatsRowProps) {
  const totalVolume = events.reduce((s, e) => s + e.volume, 0);
  const totalMarkets = events.reduce((s, e) => s + e.markets_count, 0);
  const categories = new Set(events.map((e) => e.category));

  const stats = [
    {
      icon: TrendingUp,
      label: "Total Volume",
      value: formatBig(totalVolume),
      color: "#a78bfa",
    },
    {
      icon: BarChart3,
      label: "Events",
      value: events.length.toString(),
      color: "#60a5fa",
    },
    {
      icon: DollarSign,
      label: "Markets",
      value: totalMarkets.toString(),
      color: "#34d399",
    },
    {
      icon: Trophy,
      label: "Leagues",
      value: categories.size.toString(),
      color: "#fbbf24",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${s.color}18` }}
          >
            <s.icon size={16} style={{ color: s.color }} />
          </div>
          <div>
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="text-base font-bold text-text-primary">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
