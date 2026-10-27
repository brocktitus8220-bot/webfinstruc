"use client";
import * as React from "react";
import { averageIncome, baselineIncome, sumCents } from "@repo/core";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { Stat } from "@/components/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useShellState } from "@/components/shell/shell-state";
import { describeRange } from "@/lib/date-range";
import { money, moneyWhole } from "@/lib/format";
import { useAccountScope, useMonthlyTotals, useTransactions } from "@/lib/queries";
import { TransactionTable } from "./transaction-table";

export function TransactionsView({ kind }: { kind: "income" | "expense" }) {
  const { dateRange } = useShellState();
  const { cashAccounts } = useAccountScope();
  const txs = useTransactions(kind, dateRange);
  const monthly = useMonthlyTotals(kind, 12);

  const list = txs.data ?? [];
  const amounts = list.map((t) => Math.abs(t.amountCents));
  const total = amounts.length ? sumCents(amounts) : 0;
  const months = (monthly.data ?? []).map((m) => m.amountCents);
  const isIncome = kind === "income";

  const topCategory = React.useMemo(() => {
    const by = new Map<string, number>();
    for (const t of list) by.set(t.category, (by.get(t.category) ?? 0) + Math.abs(t.amountCents));
    return [...by].sort((a, b) => b[1] - a[1])[0];
  }, [list]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Total, ${describeRange(dateRange).toLowerCase()}`} value={money(total)} loading={txs.isLoading} sub={`${list.length} transactions`} />
        <Stat label="Monthly average (12 mo)" value={moneyWhole(averageIncome(months))} loading={monthly.isLoading} />
        {isIncome ? (
          <Stat label="Baseline month" value={moneyWhole(baselineIncome(months))} loading={monthly.isLoading} sub="Lowest reliable month" />
        ) : (
          <Stat label="Largest category" value={topCategory?.[0] ?? "None"} loading={txs.isLoading} sub={topCategory ? money(topCategory[1]) : undefined} />
        )}
        <Stat
          label={isIncome ? "Largest payment" : "Largest expense"}
          value={amounts.length ? money(Math.max(...amounts)) : money(0)}
          loading={txs.isLoading}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>{isIncome ? "Income by month" : "Spending by month"}</CardTitle></CardHeader>
        <CardContent>
          {monthly.isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <MonthlyBars
              data={monthly.data ?? []}
              color={isIncome ? "chart-1" : "chart-4"}
              references={
                isIncome
                  ? [
                      { value: averageIncome(months), label: "Average", tone: "muted" },
                      { value: baselineIncome(months), label: "Baseline", tone: "primary" },
                    ]
                  : [{ value: averageIncome(months), label: "Average", tone: "muted" }]
              }
            />
          )}
        </CardContent>
      </Card>

      <TransactionTable kind={kind} transactions={list} accounts={cashAccounts} isLoading={txs.isLoading} />
    </div>
  );
}
