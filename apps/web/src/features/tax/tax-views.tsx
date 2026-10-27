"use client";
import Link from "next/link";
import { FILING_STATUS_LABELS, sumCents } from "@repo/core";
import { PlaceholderNote } from "@/components/page-header";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, money, moneyWhole } from "@/lib/format";
import { useMonthlyTotals, useTaxSettings } from "@/lib/queries";

/** Integer-cent percentage: amount × percent, rounded to the nearest cent. */
const pctOf = (cents: number, percent: number) => Math.round((cents * Math.round(percent * 100)) / 10_000);

/** Split a yearly amount into 4 quarterly cents, remainder to the earliest quarters. */
const quarters = (annual: number) => {
  const base = Math.floor(annual / 4);
  const rem = annual - base * 4;
  return [0, 1, 2, 3].map((i) => base + (i < rem ? 1 : 0));
};

const dueDates = (year: number) => [`${year}-04-15`, `${year}-06-15`, `${year}-09-15`, `${year + 1}-01-15`];

function useProjection() {
  const settings = useTaxSettings();
  const income = useMonthlyTotals("income", 12);
  const expenses = useMonthlyTotals("expense", 12);
  const gross = income.data ? sumCents(income.data.map((m) => m.amountCents)) : 0;
  const costs = expenses.data ? sumCents(expenses.data.map((m) => m.amountCents)) : 0;
  const net = Math.max(0, gross - costs);
  const s = settings.data;
  const projectedTax = s ? pctOf(net, s.estimatedEffectiveRatePercent) : 0;
  return { settings: s, gross, costs, net, projectedTax, isLoading: settings.isLoading || income.isLoading || expenses.isLoading };
}

export function EstimatesTab() {
  const p = useProjection();
  if (p.isLoading || !p.settings) return <Skeleton className="h-72 w-full" />;
  const year = p.settings.taxYear;
  const q = quarters(p.projectedTax);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <PlaceholderNote>Placeholder projection: trailing 12 months of net income times your effective rate. Not tax advice.</PlaceholderNote>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projected net income" value={moneyWhole(p.net)} sub={`${moneyWhole(p.gross)} in, ${moneyWhole(p.costs)} out`} />
        <Stat label="Effective rate" value={`${p.settings.estimatedEffectiveRatePercent}%`} sub="Federal, state, and self-employment" />
        <Stat label="Projected tax" value={moneyWhole(p.projectedTax)} />
        <Stat label="Per quarter" value={moneyWhole(q[0]!)} />
      </div>
      <Card>
        <CardHeader><CardTitle>Quarterly estimates, {year}</CardTitle></CardHeader>
        <Table>
          <THead><TR className="bg-subtle"><TH>Quarter</TH><TH>Due</TH><TH>Status</TH><TH className="text-right">Amount</TH></TR></THead>
          <TBody>
            {dueDates(year).map((due, i) => (
              <TR key={due}>
                <TD className="font-medium">Q{i + 1}</TD>
                <TD>{formatDate(due)}</TD>
                <TD>{due < today ? <Badge>Past due date</Badge> : <Badge variant="primary">Upcoming</Badge>}</TD>
                <TD className="text-right font-medium">{money(q[i]!)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

export function AssumptionsTab() {
  const { settings: s, isLoading } = useProjection();
  if (isLoading || !s) return <Skeleton className="h-60 w-full" />;
  const rows: [string, string][] = [
    ["Tax year", String(s.taxYear)],
    ["Filing status", FILING_STATUS_LABELS[s.filingStatus]],
    ["State", s.state],
    ["Effective rate", `${s.estimatedEffectiveRatePercent}%`],
    ["Prior-year total tax", money(s.priorYearTotalTaxCents)],
    ["Prior-year AGI", money(s.priorYearAgiCents)],
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Assumptions</CardTitle>
          <CardDescription>These drive every estimate on this page.</CardDescription>
        </div>
        <Link href="/app/settings/tax" className="text-xs text-primary hover:underline">Edit in settings</Link>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-2 py-2 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="tabular">{v}</dd></div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

const HIGH_AGI_THRESHOLD_CENTS = 15_000_000; // $150,000

export function SafeHarborTab() {
  const p = useProjection();
  if (p.isLoading || !p.settings) return <Skeleton className="h-60 w-full" />;
  const s = p.settings;
  const priorPct = s.priorYearAgiCents > HIGH_AGI_THRESHOLD_CENTS ? 110 : 100;
  const priorYear = pctOf(s.priorYearTotalTaxCents, priorPct);
  const currentYear = pctOf(p.projectedTax, 90);
  const required = Math.min(priorYear, currentYear);
  const options = [
    { key: "prior", label: `${priorPct}% of prior-year tax`, annual: priorYear, note: priorPct === 110 ? "Prior-year AGI was over $150,000" : "Prior-year AGI was $150,000 or less" },
    { key: "current", label: "90% of projected current-year tax", annual: currentYear, note: "Depends on this year's income holding up" },
  ];

  return (
    <div className="space-y-4">
      <PlaceholderNote>Safe harbor pays enough during the year to avoid an underpayment penalty. Placeholder math; confirm with a tax professional.</PlaceholderNote>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((o) => (
          <Card key={o.key} className={o.annual === required ? "border-primary/50 ring-1 ring-primary/20" : undefined}>
            <CardHeader>
              <div>
                <CardTitle>{o.label}</CardTitle>
                <CardDescription>{o.note}</CardDescription>
              </div>
              {o.annual === required && <Badge variant="primary">Lower</Badge>}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular">{moneyWhole(o.annual)}</div>
              <div className="text-xs text-muted-foreground">{money(quarters(o.annual)[0]!)} per quarter</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
