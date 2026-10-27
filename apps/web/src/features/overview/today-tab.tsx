"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Clock, Command as CommandIcon, FilePlus2, Minus, Plus, TrendingUp } from "lucide-react";
import {
  allocate, ALLOCATION_BUCKET_LABELS, ALLOCATION_BUCKETS, averageIncome, baselineIncome, runway,
} from "@repo/core";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { useShellState } from "@/components/shell/shell-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, money, moneyWhole } from "@/lib/format";
import { useAccountScope, useAllocationRules, useInvoices, useMonthlyTotals } from "@/lib/queries";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { cn } from "@/lib/utils";

const EXPENSE_LOOKBACK_MONTHS = 6;

export function TodayTab() {
  return (
    <div className="space-y-4">
      <QuickActionsRow />
      <div className="grid gap-4 lg:grid-cols-3">
        <RunwayHero />
        <IncomeStabilityCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RecentlyViewedCard />
        <AllocationCard />
        <InvoicesCard />
      </div>
    </div>
  );
}

function QuickActionsRow() {
  const { openQuickAction, setPaletteOpen } = useShellState();
  const actions = [
    { label: "Add income", icon: Plus, onClick: () => openQuickAction("income") },
    { label: "Add expense", icon: Minus, onClick: () => openQuickAction("expense") },
    { label: "Log invoice", icon: FilePlus2, onClick: () => openQuickAction("invoice") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <Button key={a.label} variant="outline" onClick={a.onClick}>
          <a.icon className="text-muted-foreground" /> {a.label}
        </Button>
      ))}
      <Button variant="ghost" onClick={() => setPaletteOpen(true)} className="text-muted-foreground">
        <CommandIcon /> All actions <span className="flex gap-0.5"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </Button>
    </div>
  );
}

function RunwayHero() {
  const { selectedAccounts, isLoading } = useAccountScope();
  const expenses = useMonthlyTotals("expense", EXPENSE_LOOKBACK_MONTHS);
  const cash = selectedAccounts.reduce((s, a) => s + a.balanceCents, 0);
  const burn = averageIncome((expenses.data ?? []).map((m) => m.amountCents));
  const months = runway(cash, burn);
  const tone = months >= 6 ? "positive" : months >= 3 ? "warning" : "negative";
  const loading = isLoading || expenses.isLoading;

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <div>
          <CardTitle>Runway</CardTitle>
          <CardDescription>Cash divided by average monthly spending</CardDescription>
        </div>
        {!loading && <Badge variant={tone}>{tone === "positive" ? "Healthy" : tone === "warning" ? "Watch" : "Low"}</Badge>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-12 w-40" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight tabular">{Number.isFinite(months) ? months.toFixed(1) : "∞"}</span>
            <span className="text-lg text-muted-foreground">months</span>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
          <div>
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Cash</div>
            <div className="font-medium tabular">{loading ? "…" : moneyWhole(cash)}</div>
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Avg spend / mo</div>
            <div className="font-medium tabular">{loading ? "…" : moneyWhole(burn)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomeStabilityCard() {
  const income = useMonthlyTotals("income", 12);
  const months = (income.data ?? []).map((m) => m.amountCents);
  const baseline = baselineIncome(months);
  const average = averageIncome(months);
  const gapPct = average > 0 ? Math.round(((average - baseline) / average) * 100) : 0;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Baseline vs. average income</CardTitle>
          <CardDescription>Last 12 complete months. Baseline ignores months under 20% of the median.</CardDescription>
        </div>
        <Link href="/app/income" className="text-xs text-primary hover:underline">View income</Link>
      </CardHeader>
      <CardContent>
        {income.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary" /> Baseline
                </div>
                <div className="text-2xl font-semibold tabular">{moneyWhole(baseline)}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
                  <span className="size-2 rounded-full bg-muted-foreground" /> Average
                </div>
                <div className="text-2xl font-semibold tabular">{moneyWhole(average)}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Plan fixed costs around the baseline. It sits {gapPct}% below your average month.
              </p>
            </div>
            <MonthlyBars
              data={income.data ?? []}
              height={190}
              references={[
                { value: average, label: "Average", tone: "muted" },
                { value: baseline, label: "Baseline", tone: "primary" },
              ]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentlyViewedCard() {
  const items = useRecentlyViewed();
  return (
    <Card>
      <CardHeader><CardTitle>Recently viewed</CardTitle></CardHeader>
      <CardContent className="px-2">
        {items.length === 0 ? (
          <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
            <Clock className="size-4" /> Open an income or expense item and it will show up here.
          </p>
        ) : (
          <ul>
            {items.slice(0, 6).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  {item.kind === "income" ? (
                    <ArrowDownRight className="size-4 text-positive" />
                  ) : item.kind === "expense" ? (
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  ) : (
                    <TrendingUp className="size-4 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.amountCents !== undefined && (
                    <span className={cn("text-xs tabular", item.amountCents > 0 ? "text-positive" : "text-muted-foreground")}>{money(item.amountCents)}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AllocationCard() {
  const rules = useAllocationRules();
  const income = useMonthlyTotals("income", 12);
  const average = averageIncome((income.data ?? []).map((m) => m.amountCents));
  const split = rules.data ? allocate(average, rules.data) : null;
  const total = average || 1;
  const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Average month, allocated</CardTitle>
          <CardDescription>{moneyWhole(average)} split by your rules</CardDescription>
        </div>
        <Link href="/app/settings/allocation" className="text-xs text-primary hover:underline">Edit</Link>
      </CardHeader>
      <CardContent>
        {!split ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted">
              {ALLOCATION_BUCKETS.map((b, i) => (
                <div key={b} className={colors[i]} style={{ width: `${(split[b] / total) * 100}%` }} />
              ))}
            </div>
            <ul className="space-y-1.5">
              {ALLOCATION_BUCKETS.filter((b) => split[b] > 0).map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2 rounded-full", colors[ALLOCATION_BUCKETS.indexOf(b)])} />
                  <span className="flex-1 text-muted-foreground">{ALLOCATION_BUCKET_LABELS[b]}</span>
                  <span className="font-medium tabular">{money(split[b])}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InvoicesCard() {
  const invoices = useInvoices();
  const open = (invoices.data ?? []).filter((i) => i.status !== "paid");
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Open invoices</CardTitle>
          <CardDescription>{open.length} outstanding, {money(open.reduce((s, i) => s + i.amountCents, 0))}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        {invoices.isLoading ? (
          <Skeleton className="mx-2 h-24" />
        ) : open.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">No open invoices in this workspace.</p>
        ) : (
          <ul>
            {open.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{inv.client}</span>
                  <span className="block text-2xs text-muted-foreground">{inv.number} · due {formatDate(inv.dueDate, { month: "short", day: "numeric" })}</span>
                </span>
                <Badge variant={inv.status === "overdue" ? "negative" : "default"} className="capitalize">{inv.status}</Badge>
                <span className="w-20 text-right font-medium tabular">{moneyWhole(inv.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

