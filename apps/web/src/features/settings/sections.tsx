"use client";
import * as React from "react";
import { toast } from "sonner";
import { FILING_STATUS_LABELS } from "@repo/core";
import { resetMockStorage } from "@repo/api-client/mock";
import { PlaceholderNote } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, useApiMutation } from "@/lib/api";
import { money } from "@/lib/format";
import type { SettingsSlug } from "@/lib/nav";
import { useAccounts, useAllocationRules, useMe, useTaxSettings, useTransactions } from "@/lib/queries";
import { STORAGE_KEYS } from "@/lib/storage";
import { AllocationEditor } from "../allocation/allocation-editor";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-sm normal-case tracking-normal text-foreground">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ToggleRow({ id, label, description, defaultChecked, disabled }: { id: string; label: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 py-2.5">
      <Checkbox id={id} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function Profile() {
  const me = useMe();
  if (!me.data) return <Skeleton className="h-40" />;
  return (
    <Section title="Profile" description="Synced from your sign-in account.">
      <form className="grid max-w-lg gap-3" onSubmit={(e) => { e.preventDefault(); toast("Profile editing arrives with the real API."); }}>
        <Field id="p-name" label="Name"><Input id="p-name" defaultValue={me.data.name} /></Field>
        <Field id="p-email" label="Email"><Input id="p-email" type="email" defaultValue={me.data.email} disabled /></Field>
        <Field id="p-type" label="I am a"><Input id="p-type" defaultValue={me.data.userType ?? "Not set"} disabled className="capitalize" /></Field>
        <div><Button type="submit">Save</Button></div>
      </form>
    </Section>
  );
}

function Accounts() {
  const accounts = useAccounts();
  return (
    <Section title="Connected accounts" description="Bank and brokerage connections. Sample data for now.">
      <div className="mb-3 flex justify-end">
        <Button disabled title="Bank connections arrive in a later step">Connect an account</Button>
      </div>
      {!accounts.data ? <Skeleton className="h-40" /> : (
        <ul className="divide-y rounded-md border">
          {accounts.data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.name} <span className="font-normal text-muted-foreground">···{a.mask}</span></span>
                <span className="block text-xs text-muted-foreground">{a.custodian ?? a.institution}</span>
              </span>
              <Badge className="capitalize">{a.workspaceKind}</Badge>
              <Badge variant="outline" className="capitalize">{a.type}</Badge>
              <span className="w-28 text-right tabular">{money(a.balanceCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Allocation() {
  const rules = useAllocationRules();
  const save = useApiMutation((api, body: Parameters<typeof api.saveAllocationRules>[0]["body"]) => api.saveAllocationRules({ body }));
  return (
    <Section title="Allocation rules" description="How each payment you receive is split. Percentages must add up to 100.">
      {!rules.data ? <Skeleton className="h-60" /> : (
        <AllocationEditor
          key={JSON.stringify(rules.data)}
          initial={rules.data}
          saving={save.isPending}
          onSubmit={(body) => save.mutate(body, { onSuccess: () => toast.success("Allocation rules saved") })}
        />
      )}
    </Section>
  );
}

function Categories() {
  const income = useTransactions("income");
  const expense = useTransactions("expense");
  const count = (list: { category: string }[] = []) => {
    const m = new Map<string, number>();
    for (const t of list) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  return (
    <Section title="Categories" description="Custom categories and rules arrive later. These come from your transactions.">
      <div className="grid gap-4 md:grid-cols-2">
        {([["Income", count(income.data)], ["Expenses", count(expense.data)]] as const).map(([title, cats]) => (
          <div key={title}>
            <h4 className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
            <ul className="divide-y rounded-md border">
              {cats.map(([c, n]) => (
                <li key={c} className="flex justify-between px-3 py-2 text-sm"><span>{c}</span><span className="text-muted-foreground tabular">{n}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Tax() {
  const tax = useTaxSettings();
  if (!tax.data) return <Skeleton className="h-40" />;
  const t = tax.data;
  return (
    <Section title="Tax profile" description="Used by Tax Projection. Filing status and state come from onboarding.">
      <dl className="grid max-w-lg gap-y-2 text-sm">
        {[
          ["Filing status", FILING_STATUS_LABELS[t.filingStatus]],
          ["State", t.state],
          ["Effective rate", `${t.estimatedEffectiveRatePercent}%`],
          ["Prior-year total tax", money(t.priorYearTotalTaxCents)],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-2 border-b pb-2"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </Section>
  );
}

function AiPrivacy() {
  return (
    <Section title="AI and privacy" description="AI features are not enabled yet. These choices will apply when they are.">
      <PlaceholderNote>Nothing is sent to any AI provider in this version.</PlaceholderNote>
      <div className="divide-y">
        <ToggleRow id="ai-ask" label="Allow Ask to read my transactions" description="Answers use your data only when you ask a question." disabled />
        <ToggleRow id="ai-train" label="Never use my data to train models" description="Always on." defaultChecked disabled />
      </div>
    </Section>
  );
}

function Notifications() {
  return (
    <Section title="Notifications" description="Email delivery arrives in a later step.">
      <div className="divide-y">
        <ToggleRow id="n-tax" label="Quarterly tax reminders" description="Two weeks before each estimated payment is due." defaultChecked />
        <ToggleRow id="n-runway" label="Low runway alert" description="When runway falls under 3 months." defaultChecked />
        <ToggleRow id="n-invoice" label="Overdue invoices" description="When an invoice passes its due date." />
        <ToggleRow id="n-digest" label="Weekly digest" description="Monday summary of income, spending, and runway." />
      </div>
    </Section>
  );
}

function Billing() {
  return (
    <Section title="Billing" description="Plans and payment are not live yet.">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="text-sm font-medium">Early access</div>
          <div className="text-xs text-muted-foreground">Free while in preview</div>
        </div>
        <Badge variant="primary">Current plan</Badge>
      </div>
    </Section>
  );
}

function Data() {
  const api = useApi();
  const [busy, setBusy] = React.useState(false);
  const exportJson = async () => {
    setBusy(true);
    try {
      const [accounts, transactions, invoices] = await Promise.all([api.listAccounts(), api.listTransactions(), api.listInvoices()]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), accounts, transactions, invoices }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Your data" description="Export everything, or reset the sample data in this browser.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportJson} disabled={busy}>{busy ? "Preparing" : "Export as JSON"}</Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!window.confirm("Reset sample data and onboarding answers in this browser?")) return;
            resetMockStorage(window.localStorage, STORAGE_KEYS.mockApi);
            window.location.assign("/onboarding/1");
          }}
        >
          Reset sample data
        </Button>
      </div>
    </Section>
  );
}

const SETTINGS_SECTIONS: Record<SettingsSlug, () => React.ReactElement> = {
  profile: Profile,
  accounts: Accounts,
  allocation: Allocation,
  categories: Categories,
  tax: Tax,
  "ai-privacy": AiPrivacy,
  notifications: Notifications,
  billing: Billing,
  data: Data,
};

export function SettingsSection({ slug }: { slug: SettingsSlug }) {
  const Component = SETTINGS_SECTIONS[slug];
  return <Component />;
}
