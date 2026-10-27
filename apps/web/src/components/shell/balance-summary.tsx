"use client";
import { Sparkline } from "@/components/charts/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/lib/format";
import { useAccountScope, useBalanceHistory } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function BalanceSummary() {
  const { selectedAccounts, isLoading } = useAccountScope();
  const history = useBalanceHistory(30);
  const balance = selectedAccounts.reduce((sum, a) => sum + a.balanceCents, 0);
  const points = history.data ?? [];
  const start = points[0]?.balanceCents ?? balance;
  const change = balance - start;
  const pct = start !== 0 ? (change / Math.abs(start)) * 100 : 0;
  const up = change >= 0;

  if (isLoading || history.isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="leading-tight">
        <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Current balance</div>
        <div className="flex items-baseline gap-2 tabular">
          <span className="text-lg font-semibold">{money(balance)}</span>
          <span className={cn("text-xs font-medium", up ? "text-positive" : "text-negative")} title="Change over the last 30 days">
            {up ? "+" : ""}{money(change)} ({up ? "+" : ""}{pct.toFixed(1)}%)
          </span>
        </div>
      </div>
      <Sparkline values={points.map((p) => p.balanceCents)} className="hidden sm:block" />
    </div>
  );
}
