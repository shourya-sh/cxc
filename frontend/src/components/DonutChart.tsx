"use client";

import { Outcome } from "@/lib/api";

// Color palette for outcomes
const COLORS = [
  "#a78bfa", // violet
  "#60a5fa", // blue
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#a3e635", // lime
  "#e879f9", // fuchsia
  "#f87171", // red
];

interface DonutChartProps {
  outcomes: Outcome[];
  size?: number;
}

export default function DonutChart({ outcomes, size = 100 }: DonutChartProps) {
  const top = outcomes.slice(0, 6);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments
  let cumulativeOffset = 0;
  const segments = top.map((o, i) => {
    const fraction = o.probability;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const offset = -cumulativeOffset * circumference;
    cumulativeOffset += fraction;
    return { ...o, dash, gap, offset, color: COLORS[i % COLORS.length] };
  });

  // Find the leader
  const leader = top.length > 0 ? top[0] : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#27272a"
          strokeWidth="8"
        />
        {/* Segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="8"
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={seg.offset}
            strokeLinecap="round"
            className="donut-ring"
            style={{ opacity: 0.9 }}
          />
        ))}
      </svg>
      {/* Center label */}
      {leader && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-text-primary">
            {(leader.probability * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
