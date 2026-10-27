"use client";
import * as React from "react";
import { analyzeCreditCards, type CreditCard, isCardPurchase, type MonthlyTotal, type Transaction } from "@repo/core";
import { useApiQuery } from "@/lib/api";
import { useCreditCards } from "@/lib/queries";

export const PERIOD_OPTIONS = [3, 6, 12] as const;
export type PeriodMonths = (typeof PERIOD_OPTIONS)[number];

const isoDaysAgo = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
};

/** Cards, their recent transactions, and the rewards analysis for a period. */
export function useCardAnalysis(months: PeriodMonths) {
  const cards = useCreditCards();
  const list = cards.data ?? [];
  const accountIds = list.map((c) => c.accountId);
  const from = isoDaysAgo(months);
  const query = { accountIds, from };
  const transactions = useApiQuery(["card-transactions", query], (api) => api.listTransactions({ query }), {
    enabled: accountIds.length > 0,
  });
  const txs = React.useMemo(() => transactions.data ?? [], [transactions.data]);
  const analysis = React.useMemo(() => analyzeCreditCards(list, txs, months), [list, txs, months]);
  return {
    cards: list,
    transactions: txs,
    analysis,
    isLoading: cards.isLoading || (accountIds.length > 0 && transactions.isLoading),
  };
}

/** Purchases per month across cards, oldest first, including empty months. */
export function monthlyCardSpend(transactions: readonly Transaction[], months: number): MonthlyTotal[] {
  const now = new Date();
  const totals = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    totals.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    if (isCardPurchase(t) && totals.has(m)) totals.set(m, totals.get(m)! - t.amountCents);
  }
  return [...totals].map(([month, amountCents]) => ({ month, amountCents }));
}

export const CONNECTION_LABELS: Record<CreditCard["connection"], string> = {
  plaid: "Plaid",
  csv: "Statement import",
  sample: "Sample",
  manual: "Manual",
};

export const formatBasisPoints = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : bp % 10 === 0 ? 1 : 2)}%`;
