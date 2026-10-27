"use client";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";

/** Tiny trend line. Green when the series ends higher than it starts, red otherwise. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const tone = last >= first ? "positive" : "negative";
  const color = `hsl(var(--color-${tone}))`;
  const id = `spark-${tone}`;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className={cn("h-8 w-24", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
