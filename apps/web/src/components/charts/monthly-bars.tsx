"use client";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyTotal } from "@repo/core";
import { formatMonth, money, moneyCompact } from "@/lib/format";

export interface ReferenceMark {
  value: number;
  label: string;
  tone: "primary" | "muted" | "warning";
}

const toneColor = { primary: "hsl(var(--color-primary))", muted: "hsl(var(--color-muted-foreground))", warning: "hsl(var(--color-warning))" };

export function MonthlyBars({ data, references = [], height = 180, color = "chart-1" }: { data: MonthlyTotal[]; references?: ReferenceMark[]; height?: number; color?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: references.length ? 58 : 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--color-border))" />
          <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--color-muted-foreground))" />
          <YAxis tickFormatter={(v: number) => moneyCompact(Math.round(v))} tickLine={false} axisLine={false} fontSize={11} width={52} stroke="hsl(var(--color-muted-foreground))" />
          <Tooltip
            cursor={{ fill: "hsl(var(--color-muted))" }}
            contentStyle={{ background: "hsl(var(--color-surface))", border: "1px solid hsl(var(--color-border))", borderRadius: 6, fontSize: 12 }}
            labelFormatter={(m: string) => formatMonth(m)}
            formatter={(v: number) => [money(v), "Total"]}
          />
          <Bar dataKey="amountCents" fill={`hsl(var(--color-${color}))`} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          {references.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.value}
              stroke={toneColor[r.tone]}
              strokeDasharray="4 3"
              label={{ value: r.label, position: "right", fontSize: 10, fill: toneColor[r.tone] }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
