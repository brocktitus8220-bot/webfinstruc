"use client";
import * as React from "react";
import { type CreditCard, formatEarnRate, REWARD_CATEGORY_LABELS, RewardCategory, valueRateBasisPoints, type WorkspaceKind } from "@repo/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyCards } from "./empty-cards";
import { PeriodSelect, usePeriod } from "./period-select";
import { formatBasisPoints, useCardAnalysis } from "./use-card-analysis";

export function CardsOptimizeTab() {
  const [months, setMonths] = usePeriod();
  const { cards, analysis, isLoading } = useCardAnalysis(months);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (cards.length === 0) return <EmptyCards />;
  const name = (id: string) => cards.find((c) => c.accountId === id)?.name ?? "Card";
  const kinds = (["business", "personal"] as const).filter((k) => cards.some((c) => c.workspaceKind === k));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div>
            <CardTitle>Spending vs. the best card</CardTitle>
            <CardDescription>
              What you earned on each category, and what the best card in the same workspace would have earned. Business spending is only matched to business cards.
            </CardDescription>
          </div>
          <PeriodSelect value={months} onChange={setMonths} />
        </CardHeader>
        {analysis.categories.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No card purchases in this period.</p>
        ) : (
          <Table>
            <THead>
              <TR className="bg-subtle">
                <TH>Category</TH><TH>Paid with</TH><TH className="text-right">Spend</TH><TH className="text-right">Earned</TH>
                <TH>Best card</TH><TH className="text-right">Could earn</TH><TH className="text-right">Missed</TH>
              </TR>
            </THead>
            <TBody>
              {analysis.categories.map((c) => (
                <TR key={`${c.workspaceKind}:${c.category}`}>
                  <TD>
                    <span className="block">{REWARD_CATEGORY_LABELS[c.category]}</span>
                    {kinds.length > 1 && <span className="block text-2xs capitalize text-muted-foreground">{c.workspaceKind}</span>}
                  </TD>
                  <TD className="text-xs text-muted-foreground">{c.byCard.map((b) => name(b.accountId)).join(", ")}</TD>
                  <TD className="text-right">{money(c.spendCents)}</TD>
                  <TD className="text-right">{money(c.earnedCents)}</TD>
                  <TD>
                    {name(c.bestAccountId)} <span className="text-xs text-muted-foreground">{formatBasisPoints(c.bestValueRateBasisPoints)}</span>
                  </TD>
                  <TD className="text-right">{money(c.bestPossibleCents)}</TD>
                  <TD className={cn("text-right font-medium", c.missedCents > 0 ? "text-warning" : "text-muted-foreground")}>
                    {c.missedCents > 0 ? money(c.missedCents) : "None"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* A grid only helps when there is more than one card to choose between. */}
      {kinds
        .filter((kind) => cards.filter((c) => c.workspaceKind === kind).length > 1)
        .map((kind) => (
          <BestCardGrid key={kind} kind={kind} cards={cards.filter((c) => c.workspaceKind === kind)} showKind={kinds.length > 1} />
        ))}
    </div>
  );
}

/** Which card to reach for, per category. Values include point value, so 3x at 1.25 cents shows as 3.75%. */
function BestCardGrid({ kind, cards, showKind }: { kind: WorkspaceKind; cards: CreditCard[]; showKind: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle>Which card to use{showKind ? ` · ${kind === "business" ? "Business" : "Personal"}` : ""}</CardTitle>
          <CardDescription>Cash value per dollar. The best card for each category is highlighted. Bonus caps are noted.</CardDescription>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR className="bg-subtle">
              <TH>Category</TH>
              {cards.map((c) => <TH key={c.accountId} className="text-right">{c.name}</TH>)}
            </TR>
          </THead>
          <TBody>
            {RewardCategory.options.map((category) => {
              const values = cards.map((c) => valueRateBasisPoints(c.profile, category));
              const best = Math.max(...values);
              return (
                <TR key={category}>
                  <TD>{REWARD_CATEGORY_LABELS[category]}</TD>
                  {cards.map((c, i) => {
                    const cap = c.profile.rates.find((r) => r.category === category)?.annualCapCents;
                    const isBest = values[i] === best && cards.length > 1;
                    return (
                      <TD key={c.accountId} className="text-right">
                        <span className={cn("tabular", isBest && "font-semibold text-positive")}>{formatBasisPoints(values[i]!)}</span>
                        {c.profile.rewardType !== "cashback" && <span className="ml-1 text-2xs text-muted-foreground">({formatEarnRate(c.profile, category)})</span>}
                        {cap ? <Badge variant="outline" className="ml-1">up to {money(cap)}/yr</Badge> : null}
                      </TD>
                    );
                  })}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
