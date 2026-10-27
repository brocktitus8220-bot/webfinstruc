"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Stat } from "@/components/stat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/lib/api";
import { money } from "@/lib/format";
import { useAccounts } from "@/lib/queries";
import { useRecordView } from "@/lib/recently-viewed";
import { ASSET_CLASS_LABELS, formatShares } from "./holdings-view";

export function HoldingDetail({ id }: { id: string }) {
  const holding = useApiQuery(["holding", id], (api) => api.getHolding({ params: { id } }));
  const accounts = useAccounts();
  const h = holding.data;
  useRecordView(h ? { href: `/app/investments/${h.id}`, label: `${h.symbol}: ${h.name}`, kind: "investment", amountCents: h.marketValueCents } : null);

  if (holding.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!h) {
    return (
      <div className="space-y-3">
        <PageHeader title="Not found" description="This holding does not exist in the current workspace." />
        <Button asChild variant="outline"><Link href="/app/investments"><ArrowLeft /> Back</Link></Button>
      </div>
    );
  }
  const account = accounts.data?.find((a) => a.id === h.accountId);
  const back = account?.custodian ? "/app/custodian-investments" : "/app/investments";
  const gain = h.marketValueCents - h.costBasisCents;

  return (
    <div className="space-y-4">
      <Link href={back} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {account?.custodian ? "Custodian Investments" : "Investments"}
      </Link>
      <PageHeader title={`${h.symbol}`} description={h.name} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Market value" value={money(h.marketValueCents)} />
        <Stat label="Shares" value={formatShares(h.quantityMilli)} />
        <Stat label="Price" value={money(h.priceCents)} />
        <Stat label="Unrealized gain" value={<span className={gain >= 0 ? "text-positive" : "text-negative"}>{gain >= 0 ? "+" : ""}{money(gain)}</span>} />
      </div>
      <Card>
        <CardHeader><CardTitle>Position</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between border-b py-1.5"><dt className="text-muted-foreground">Account</dt><dd>{account ? `${account.name} ···${account.mask}` : h.accountId}</dd></div>
            <div className="flex justify-between border-b py-1.5"><dt className="text-muted-foreground">Asset class</dt><dd>{ASSET_CLASS_LABELS[h.assetClass]}</dd></div>
            <div className="flex justify-between border-b py-1.5"><dt className="text-muted-foreground">Cost basis</dt><dd className="tabular">{money(h.costBasisCents)}</dd></div>
            <div className="flex justify-between border-b py-1.5"><dt className="text-muted-foreground">Custodian</dt><dd>{account?.custodian ?? "Self-directed"}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
