"use client";
import * as React from "react";

import { useRouter } from "next/navigation";
import type { Account, Holding } from "@repo/core";
import { PlaceholderNote } from "@/components/page-header";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { money } from "@/lib/format";
import { useAccounts, useHoldings } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const ASSET_CLASS_LABELS: Record<Holding["assetClass"], string> = {
  equity: "Equity", fixed_income: "Fixed income", cash: "Cash", fund: "Fund", other: "Other",
};

export const formatShares = (milli: number) =>
  (milli / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });

export function HoldingsView({ custodial }: { custodial: boolean }) {
  const router = useRouter();
  const holdings = useHoldings(custodial);
  const accounts = useAccounts();
  const list = holdings.data ?? [];
  const byAccount = React.useMemo(() => {
    const map = new Map<string, Holding[]>();
    for (const h of list) map.set(h.accountId, [...(map.get(h.accountId) ?? []), h]);
    return map;
  }, [list]);
  const accountList = (accounts.data ?? []).filter((a) => byAccount.has(a.id));

  const value = list.reduce((s, h) => s + h.marketValueCents, 0);
  const cost = list.reduce((s, h) => s + h.costBasisCents, 0);
  const gain = value - cost;
  const custodians = [...new Set(accountList.map((a) => a.custodian).filter(Boolean))];
  const loading = holdings.isLoading || accounts.isLoading;

  return (
    <div className="space-y-4">
      {custodial && (
        <PlaceholderNote>
          Read-only view of accounts held by a third-party custodian on your behalf. Custodian data feeds arrive in a later step.
        </PlaceholderNote>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Market value" value={money(value)} loading={loading} />
        <Stat label="Cost basis" value={money(cost)} loading={loading} />
        <Stat
          label="Unrealized gain"
          value={<span className={gain >= 0 ? "text-positive" : "text-negative"}>{gain >= 0 ? "+" : ""}{money(gain)}</span>}
          sub={cost ? `${((gain / cost) * 100).toFixed(1)}%` : undefined}
          loading={loading}
        />
        <Stat label={custodial ? "Custodians" : "Accounts"} value={custodial ? custodians.length : accountList.length} loading={loading} sub={custodial ? custodians.join(", ") : undefined} />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : accountList.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No {custodial ? "custodian" : "investment"} accounts in this workspace.</Card>
      ) : (
        accountList.map((account) => (
          <AccountHoldings key={account.id} account={account} holdings={byAccount.get(account.id) ?? []} onOpen={(h) => router.push(`/app/investments/${h.id}`)} />
        ))
      )}
    </div>
  );
}

function AccountHoldings({ account, holdings, onOpen }: { account: Account; holdings: Holding[]; onOpen: (h: Holding) => void }) {
  const total = holdings.reduce((s, h) => s + h.marketValueCents, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="normal-case tracking-normal text-sm text-foreground">{account.name} <span className="font-normal text-muted-foreground">···{account.mask}</span></CardTitle>
          <CardDescription>
            {account.custodian ? `Held at ${account.custodian}` : account.institution} · <span className="capitalize">{account.workspaceKind}</span> · <span className="capitalize">{account.type}</span>
          </CardDescription>
        </div>
        <span className="text-sm font-semibold tabular">{money(total)}</span>
      </CardHeader>
      <Table>
        <THead>
          <TR className="bg-subtle">
            <TH>Symbol</TH><TH>Name</TH><TH>Class</TH><TH className="text-right">Shares</TH><TH className="text-right">Price</TH>
            <TH className="text-right">Value</TH><TH className="text-right">Gain</TH><TH className="text-right">Weight</TH>
          </TR>
        </THead>
        <TBody>
          {holdings.map((h) => {
            const gain = h.marketValueCents - h.costBasisCents;
            return (
              <TR key={h.id} tabIndex={0} onClick={() => onOpen(h)} onKeyDown={(e) => e.key === "Enter" && onOpen(h)} className="cursor-pointer hover:bg-muted/60">
                <TD className="font-mono text-xs font-medium">{h.symbol}</TD>
                <TD className="max-w-64 truncate">{h.name}</TD>
                <TD><Badge>{ASSET_CLASS_LABELS[h.assetClass]}</Badge></TD>
                <TD className="text-right">{formatShares(h.quantityMilli)}</TD>
                <TD className="text-right">{money(h.priceCents)}</TD>
                <TD className="text-right font-medium">{money(h.marketValueCents)}</TD>
                <TD className={cn("text-right", gain > 0 ? "text-positive" : gain < 0 ? "text-negative" : "text-muted-foreground")}>{gain > 0 ? "+" : ""}{money(gain)}</TD>
                <TD className="text-right text-muted-foreground">{total ? ((h.marketValueCents / total) * 100).toFixed(1) : "0.0"}%</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}

