"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allocate, ALLOCATION_BUCKET_LABELS, ALLOCATION_BUCKETS } from "@repo/core";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import { useAccounts, useAllocationRules } from "@/lib/queries";
import { useRecordView } from "@/lib/recently-viewed";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./source-badge";

export function TransactionDetail({ id, kind }: { id: string; kind: "income" | "expense" }) {
  const tx = useApiQuery(["transaction", id], (api) => api.getTransaction({ params: { id } }));
  const accounts = useAccounts();
  const rules = useAllocationRules();
  const listHref = kind === "income" ? "/app/income" : "/app/expenses";
  const t = tx.data;

  useRecordView(t ? { href: `${listHref}/${t.id}`, label: t.description, kind, amountCents: t.amountCents } : null);

  if (tx.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!t || tx.isError) {
    return (
      <div className="space-y-3">
        <PageHeader title="Not found" description="This transaction does not exist in the current workspace." />
        <Button asChild variant="outline"><Link href={listHref}><ArrowLeft /> Back</Link></Button>
      </div>
    );
  }

  const account = accounts.data?.find((a) => a.id === t.accountId);
  const split = kind === "income" && rules.data && t.amountCents > 0 ? allocate(t.amountCents, rules.data) : null;
  const rows: [string, ReactNode][] = [
    ["Date", formatDate(t.date)],
    ["Account", account ? `${account.name} ···${account.mask}` : t.accountId],
    [kind === "income" ? "Payer" : "Payee", t.counterparty ?? "None"],
    ["Category", t.category],
    ["Source", <SourceBadge key="s" source={t.source} />],
    ["Status", <Badge key="p" variant={t.pending ? "warning" : "default"}>{t.pending ? "Pending" : "Cleared"}</Badge>],
    ["Workspace", <span key="w" className="capitalize">{t.workspaceKind}</span>],
    ["Notes", t.notes ?? "None"],
  ];

  return (
    <div className="space-y-4">
      <Link href={listHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {kind === "income" ? "Income" : "Expenses"}
      </Link>
      <PageHeader
        title={t.description}
        description={<span className={cn("text-2xl font-semibold tabular", t.amountCents > 0 ? "text-positive" : "text-foreground")}>{t.amountCents > 0 ? "+" : ""}{money(t.amountCents)}</span>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-3 py-2 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        {split && (
          <Card>
            <CardHeader><CardTitle>Suggested split</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ALLOCATION_BUCKETS.filter((b) => rules.data?.some((r) => r.bucket === b)).map((b) => (
                <div key={b} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{ALLOCATION_BUCKET_LABELS[b]} <span className="text-2xs">({rules.data?.find((r) => r.bucket === b)?.percent}%)</span></span>
                  <span className="font-medium tabular">{money(split[b])}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">Based on your allocation rules. Change them in <Link className="text-primary hover:underline" href="/app/settings/allocation">Settings</Link>.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
