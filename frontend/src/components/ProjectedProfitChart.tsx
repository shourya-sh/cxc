"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Row {
  name: string;
  expected_profit: number;
}

interface Props {
  rows: any[];
  total: number;
  eventId: string;
  points?: number;
}

function hash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function generateSeries(eventId: string, total: number, points = 14) {
  const seed = hash(eventId) % 1000;
  const amplitude = Math.max(Math.abs(total), 1) * 0.9;
  const series: { name: string; value: number }[] = [];
  const start = new Date();

  for (let i = 0; i < points; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const label = day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

    const t = i / (points - 1);
    const base = total * t; // linear drift toward total
    // Deterministic pseudo-noise
    const s1 = Math.sin((i + seed % 7) * 0.9) * 0.25;
    const s2 = Math.sin((i + (seed % 5)) * 2.3) * 0.12;
    const s3 = Math.sin((i * 0.5 + (seed % 3)) * 1.7) * 0.08;
    const noise = (s1 + s2 + s3) * amplitude;
    const value = Math.round((base + noise) * 100) / 100; // 2 decimals

    series.push({ name: label, value });
  }
  return series;
}

export default function ProjectedProfitChart({ rows, total, eventId, points = 14 }: Props) {
  const data = useMemo(() => generateSeries(eventId, total, points), [eventId, total, points]);

  return (
    <div className="w-full h-full relative">
      <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(245,166,35,0.06) 0%, transparent 40%), radial-gradient(ellipse at 80% 70%, rgba(245,166,35,0.04) 0%, transparent 35%)' }} />

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 18, left: -8, bottom: 6 }}>
          <defs>
            <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f5a623" stopOpacity={0.34} />
              <stop offset="35%" stopColor="#f5a623" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={true} horizontal={false} stroke="#1f2937" strokeDasharray="3 6" />

          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} padding={{ left: 8, right: 8 }} />
          <YAxis tickFormatter={(v) => `$${Math.round(v)}`} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />

          <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} contentStyle={{ background: '#0b0b0d', border: '1px solid rgba(255,255,255,0.04)', color: '#fff' }} />

          <Area type="monotone" dataKey="value" stroke="#f5a623" strokeWidth={3} fill="url(#g1)" dot={false} activeDot={{ r: 5, stroke: '#f5a623', strokeWidth: 2, fill: '#0b0b0d' }} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Glow at top for style */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-24" style={{ background: 'linear-gradient(180deg, rgba(245,166,35,0.06), transparent)' }} />
    </div>
  );
}
