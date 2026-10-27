"use client";
import Link from "next/link";
import { AlertTriangle, Lightbulb } from "lucide-react";
import type { CardRecommendation } from "@repo/core";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { money } from "@/lib/format";
import { PeriodSelect, usePeriod } from "./period-select";
import { CONNECTION_LABELS, formatBasisPoints, monthlyCardSpend, useCardAnalysis } from "./use-card-analysis";
import { UtilizationBar } from "./utilization-bar";
import { EmptyCards } from "./empty-cards";

export function CardsOverviewTab() {
  const [months, setMonths] = usePeriod();
  const { cards, transactions, analysis, isLoading } = useCardAnalysis(months);
  if (!isLoading && cards.length === 0) return <EmptyCards />;
  const { totals } = analysis;
  const yearlyMissed = Math.round((totals.missedCents * 12) / months);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PeriodSelect value={months} onChange={setMonths} /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Owed across cards" value={money(totals.owedCents)} sub={totals.limitCents ? `of ${money(totals.limitCents)} in limits` : undefined} loading={isLoading} />
        <Stat
          label="Utilization"
          value={totals.utilizationBasisPoints === null ? "Add limits" : formatBasisPoints(totals.utilizationBasisPoints)}
          sub="Keep it under 30%"
          loading={isLoading}
        />
        <Stat label="Rewards earned" value={<span className="text-positive">{money(totals.rewardsCents)}</span>} sub={`on ${money(totals.spendCents)} of purchases`} loading={isLoading} />
        <Stat
          label="Left on the table"
          value={<span className={totals.missedCents > 0 ? "text-warning" : undefined}>{money(totals.missedCents)}</span>}
          sub={yearlyMissed > 0 ? `about ${money(yearlyMissed)} a year with the right card` : "Every purchase is on its best card"}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Card spending by month</CardTitle>
              <CardDescription>Purchases only. Payments and refunds are left out.</CardDescription>
            </div>
          </CardHeader>
          <div className="px-2 pb-3">{isLoading ? <Skeleton className="mx-2 h-44" /> : <MonthlyBars data={monthlyCardSpend(transactions, months)} height={180} />}</div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>What to change</CardTitle>
              <CardDescription>Ranked by impact.</CardDescription>
            </div>
          </CardHeader>
          <div className="px-4 pb-4">
            {isLoading ? <Skeleton className="h-44" /> : <Recommendations items={analysis.recommendations.slice(0, 5)} />}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Your cards</CardTitle>
          <Button asChild size="sm" variant="outline"><Link href="/app/credit-cards?tab=cards">Edit cards</Link></Button>
        </CardHeader>
        {isLoading ? <Skeleton className="m-4 h-32" /> : (
          <Table>
            <THead>
              <TR className="bg-subtle">
                <TH>Card</TH><TH>Source</TH><TH className="text-right">Owed</TH><TH>Utilization</TH>
                <TH className="text-right">Spend</TH><TH className="text-right">Rewards</TH><TH className="text-right">Net per year</TH><TH className="text-right">Due</TH>
              </TR>
            </THead>
            <TBody>
              {cards.map((card) => {
                const s = analysis.cards.find((c) => c.accountId === card.accountId)!;
                return (
                  <TR key={card.accountId}>
                    <TD>
                      <span className="block font-medium">{card.name} <span className="font-normal text-muted-foreground">···{card.mask}</span></span>
                      <span className="block text-xs capitalize text-muted-foreground">{card.institution} · {card.workspaceKind}</span>
                    </TD>
                    <TD><Badge variant="outline">{CONNECTION_LABELS[card.connection]}</Badge></TD>
                    <TD className="text-right">{money(s.owedCents)}</TD>
                    <TD><UtilizationBar basisPoints={s.utilizationBasisPoints} /></TD>
                    <TD className="text-right">{money(s.spendCents)}</TD>
                    <TD className="text-right text-positive">{money(s.rewardsCents)}</TD>
                    <TD className={s.netAnnualValueCents < 0 ? "text-right text-negative" : "text-right"}>
                      {money(s.netAnnualValueCents)}
                      {s.annualFeeCents > 0 && <span className="block text-2xs text-muted-foreground">after {money(s.annualFeeCents)} fee</span>}
                    </TD>
                    <TD className="text-right text-muted-foreground">{card.profile.dueDay ? `Day ${card.profile.dueDay}` : "Not set"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Recommendations({ items }: { items: CardRecommendation[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing to change. Your cards are set up well for how you spend.</p>;
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="flex gap-2.5">
          {r.severity === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> : <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />}
          <div className="min-w-0">
            <div className="text-sm font-medium">{r.title}</div>
            <div className="text-xs text-muted-foreground">{r.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
