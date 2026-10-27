"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { averageIncome, baselineIncome } from "@repo/core";
import { PlaceholderNote } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonth, money, moneyCompact } from "@/lib/format";
import { useAccountScope, useMonthlyTotals } from "@/lib/queries";

const HORIZON = 6;

export function ForecastTab() {
  const { selectedAccounts } = useAccountScope();
  const income = useMonthlyTotals("income", 12);
  const expenses = useMonthlyTotals("expense", 6);
  const cash = selectedAccounts.reduce((s, a) => s + a.balanceCents, 0);
  const baseline = baselineIncome((income.data ?? []).map((m) => m.amountCents));
  const average = averageIncome((income.data ?? []).map((m) => m.amountCents));
  const burn = averageIncome((expenses.data ?? []).map((m) => m.amountCents));

  const now = new Date();
  const data = Array.from({ length: HORIZON + 1 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { month, conservative: cash + i * (baseline - burn), typical: cash + i * (average - burn) };
  });

  return (
    <div className="space-y-4">
      <PlaceholderNote>Placeholder forecast: a straight-line projection from baseline and average income. Scenario modeling arrives in a later step.</PlaceholderNote>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Projected cash, next {HORIZON} months</CardTitle>
            <CardDescription>Conservative uses baseline income. Typical uses average income. Both subtract average spending.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {income.isLoading || expenses.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--color-border))" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--color-muted-foreground))" />
                  <YAxis tickFormatter={(v: number) => moneyCompact(Math.round(v))} tickLine={false} axisLine={false} width={56} fontSize={11} stroke="hsl(var(--color-muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--color-surface))", border: "1px solid hsl(var(--color-border))", borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(m: string) => formatMonth(m)}
                    formatter={(v: number, name: string) => [money(Math.round(v)), name === "typical" ? "Typical" : "Conservative"]}
                  />
                  <Area dataKey="typical" stroke="hsl(var(--color-chart-1))" fill="hsl(var(--color-chart-1) / 0.12)" strokeWidth={1.5} isAnimationActive={false} />
                  <Area dataKey="conservative" stroke="hsl(var(--color-chart-4))" fill="hsl(var(--color-chart-4) / 0.08)" strokeDasharray="4 3" strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
