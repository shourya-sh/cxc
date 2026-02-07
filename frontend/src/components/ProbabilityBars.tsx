"use client";

import { Outcome } from "@/lib/api";

const COLORS = [
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
  "#a3e635",
  "#e879f9",
  "#f87171",
];

interface ProbabilityBarsProps {
  outcomes: Outcome[];
  maxItems?: number;
}

export default function ProbabilityBars({
  outcomes,
  maxItems = 5,
}: ProbabilityBarsProps) {
  const top = outcomes.slice(0, maxItems);
  const remaining = outcomes.slice(maxItems);
  const othersProb = remaining.reduce((s, o) => s + o.probability, 0);

  return (
    <div className="space-y-2.5">
      {top.map((o, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary truncate max-w-[70%]">
              {o.name}
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: COLORS[i % COLORS.length] }}
            >
              {(o.probability * 100).toFixed(1)}%
            </span>
          </div>
          <div className="prob-bar">
            <div
              className="prob-fill"
              style={{
                width: `${Math.max(o.probability * 100, 1)}%`,
                background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[i % COLORS.length]}88)`,
              }}
            />
          </div>
        </div>
      ))}
      {othersProb > 0.005 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">
              +{remaining.length} others
            </span>
            <span className="text-xs text-text-muted">
              {(othersProb * 100).toFixed(1)}%
            </span>
          </div>
          <div className="prob-bar">
            <div
              className="prob-fill"
              style={{
                width: `${Math.max(othersProb * 100, 1)}%`,
                background: "#3f3f46",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
