"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CREDIT_CARD_PRESETS, type CreditCard, type CreditCardProfile, findCreditCardPreset, parseCurrencyToCents,
  REWARD_CATEGORY_LABELS, RewardCategory, type RewardType, SaveCreditCardInput,
} from "@repo/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useApiMutation } from "@/lib/api";
import { money } from "@/lib/format";
import { CONNECTION_LABELS } from "./use-card-analysis";

/** "3", "3.5", "24.99" to basis points. Null when blank, NaN when invalid. */
function toBasisPoints(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  return /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : Number.NaN;
}
const fromBasisPoints = (bp: number | null) => (bp === null ? "" : String(bp / 100));
const centsToInput = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2));
const moneyInput = (value: string): number | null => (value.trim() === "" ? null : (parseCurrencyToCents(value) ?? Number.NaN));
const dayInput = (value: string): number | null => (value.trim() === "" ? null : /^\d{1,2}$/.test(value.trim()) ? Number(value) : Number.NaN);

interface RateRow { key: number; category: RewardCategory; rate: string; cap: string }
interface FormState {
  preset: string;
  limit: string;
  apr: string;
  fee: string;
  statementDay: string;
  dueDay: string;
  rewardType: RewardType;
  pointValue: string;
  baseRate: string;
  rates: RateRow[];
  owed: string;
}

let rowKey = 0;
const toForm = (card: CreditCard): FormState => ({
  preset: card.profile.preset ?? "",
  limit: centsToInput(card.profile.creditLimitCents),
  apr: fromBasisPoints(card.profile.aprBasisPoints),
  fee: centsToInput(card.profile.annualFeeCents),
  statementDay: card.profile.statementDay ? String(card.profile.statementDay) : "",
  dueDay: card.profile.dueDay ? String(card.profile.dueDay) : "",
  rewardType: card.profile.rewardType,
  pointValue: String(card.profile.pointValueHundredthsOfCent / 100),
  baseRate: fromBasisPoints(card.profile.baseRateBasisPoints),
  rates: card.profile.rates.map((r) => ({ key: rowKey++, category: r.category, rate: fromBasisPoints(r.rateBasisPoints), cap: centsToInput(r.annualCapCents) })),
  owed: centsToInput(Math.max(0, -card.balanceCents)),
});

/** Edit one card's limit, dates, fee, and rewards. */
export function CardEditor({ card }: { card: CreditCard }) {
  const [form, setForm] = React.useState<FormState>(() => toForm(card));
  const [error, setError] = React.useState<string>();
  const save = useApiMutation((api, body: SaveCreditCardInput) => api.saveCreditCard({ params: { accountId: card.accountId }, body }));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const unit = form.rewardType === "cashback" ? "%" : "x";
  const isPlaid = card.connection === "plaid";
  const id = (name: string) => `${card.accountId}-${name}`;

  const applyPreset = (presetId: string) => {
    const preset = findCreditCardPreset(presetId);
    if (!preset) return set("preset", "");
    const p = preset.profile;
    setForm((f) => ({
      ...f,
      preset: presetId,
      fee: centsToInput(p.annualFeeCents),
      rewardType: p.rewardType,
      pointValue: String(p.pointValueHundredthsOfCent / 100),
      baseRate: fromBasisPoints(p.baseRateBasisPoints),
      rates: p.rates.map((r) => ({ key: rowKey++, category: r.category, rate: fromBasisPoints(r.rateBasisPoints), cap: centsToInput(r.annualCapCents) })),
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const profile: CreditCardProfile & { owedCents?: number } = {
      preset: form.preset || null,
      creditLimitCents: moneyInput(form.limit),
      aprBasisPoints: toBasisPoints(form.apr),
      annualFeeCents: moneyInput(form.fee) ?? 0,
      statementDay: dayInput(form.statementDay),
      dueDay: dayInput(form.dueDay),
      rewardType: form.rewardType,
      pointValueHundredthsOfCent: form.rewardType === "cashback" ? 100 : (toBasisPoints(form.pointValue) ?? Number.NaN),
      baseRateBasisPoints: toBasisPoints(form.baseRate) ?? 0,
      rates: form.rates.map((r) => ({ category: r.category, rateBasisPoints: toBasisPoints(r.rate) ?? Number.NaN, annualCapCents: moneyInput(r.cap) })),
    };
    if (!isPlaid) {
      const owed = moneyInput(form.owed);
      if (owed !== null) profile.owedCents = owed;
    }
    const parsed = SaveCreditCardInput.safeParse(profile);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const field = issue.path.filter((p) => typeof p === "string").join(" ");
      return setError(`Check ${field || "the form"}: ${issue.message === "Expected number, received nan" ? "enter a number" : issue.message}`);
    }
    save.mutate(parsed.data, {
      onSuccess: (saved) => {
        setForm(toForm(saved));
        toast.success(`${card.name} saved`);
      },
      onError: (err) => setError(err.message),
    });
  };

  const presetInfo = findCreditCardPreset(form.preset);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-sm normal-case tracking-normal text-foreground">
            {card.name} <span className="font-normal text-muted-foreground">···{card.mask}</span>
          </CardTitle>
          <CardDescription className="capitalize">{card.institution} · {card.workspaceKind}</CardDescription>
        </div>
        <Badge variant="outline">{CONNECTION_LABELS[card.connection]}</Badge>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id={id("preset")} label="Start from" hint={presetInfo?.description ?? "Pick a template, then adjust to match your card's terms."}>
            <NativeSelect id={id("preset")} value={form.preset} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">Custom</option>
              {CREDIT_CARD_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </NativeSelect>
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={id("limit")} label="Credit limit ($)"><Input id={id("limit")} inputMode="decimal" value={form.limit} onChange={(e) => set("limit", e.target.value)} placeholder="8000" /></Field>
            <Field id={id("apr")} label="APR (%)"><Input id={id("apr")} inputMode="decimal" value={form.apr} onChange={(e) => set("apr", e.target.value)} placeholder="24.99" /></Field>
            <Field id={id("fee")} label="Annual fee ($)"><Input id={id("fee")} inputMode="decimal" value={form.fee} onChange={(e) => set("fee", e.target.value)} placeholder="0" /></Field>
            <Field id={id("stmt")} label="Statement closes (day)"><Input id={id("stmt")} inputMode="numeric" value={form.statementDay} onChange={(e) => set("statementDay", e.target.value)} placeholder="20" /></Field>
            <Field id={id("due")} label="Payment due (day)"><Input id={id("due")} inputMode="numeric" value={form.dueDay} onChange={(e) => set("dueDay", e.target.value)} placeholder="15" /></Field>
            {isPlaid ? (
              <Field id={id("owed")} label="Owed" hint="Updated by your bank through Plaid.">
                <Input id={id("owed")} value={money(Math.max(0, -card.balanceCents))} disabled />
              </Field>
            ) : (
              <Field id={id("owed")} label="Owed now ($)" hint="Statements do not include a balance, so set it here.">
                <Input id={id("owed")} inputMode="decimal" value={form.owed} onChange={(e) => set("owed", e.target.value)} />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={id("type")} label="Rewards">
              <NativeSelect id={id("type")} value={form.rewardType} onChange={(e) => set("rewardType", e.target.value as RewardType)}>
                <option value="cashback">Cash back</option>
                <option value="points">Points</option>
                <option value="miles">Miles</option>
              </NativeSelect>
            </Field>
            {form.rewardType !== "cashback" && (
              <Field id={id("pv")} label={`Value per ${form.rewardType === "miles" ? "mile" : "point"} (cents)`}>
                <Input id={id("pv")} inputMode="decimal" value={form.pointValue} onChange={(e) => set("pointValue", e.target.value)} placeholder="1.25" />
              </Field>
            )}
            <Field id={id("base")} label={`Everything else (${unit})`}>
              <Input id={id("base")} inputMode="decimal" value={form.baseRate} onChange={(e) => set("baseRate", e.target.value)} placeholder="1" />
            </Field>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium">Bonus categories</div>
            {form.rates.length === 0 && <p className="mb-2 text-xs text-muted-foreground">None. Every purchase earns the base rate.</p>}
            <div className="space-y-2">
              {form.rates.map((r, i) => (
                <div key={r.key} className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label="Category"
                    className="w-52"
                    value={r.category}
                    onChange={(e) => set("rates", form.rates.map((x, j) => (j === i ? { ...x, category: e.target.value as RewardCategory } : x)))}
                  >
                    {RewardCategory.options.filter((c) => c !== "other").map((c) => <option key={c} value={c}>{REWARD_CATEGORY_LABELS[c]}</option>)}
                  </NativeSelect>
                  <Input aria-label={`Rate (${unit})`} className="w-20" inputMode="decimal" value={r.rate} placeholder="3"
                    onChange={(e) => set("rates", form.rates.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
                  <span className="text-xs text-muted-foreground">{unit}, yearly cap $</span>
                  <Input aria-label="Yearly cap in dollars" className="w-28" inputMode="decimal" value={r.cap} placeholder="none"
                    onChange={(e) => set("rates", form.rates.map((x, j) => (j === i ? { ...x, cap: e.target.value } : x)))} />
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove category" onClick={() => set("rates", form.rates.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                const used = new Set(form.rates.map((r) => r.category));
                const next = RewardCategory.options.find((c) => c !== "other" && !used.has(c)) ?? "dining";
                set("rates", [...form.rates, { key: rowKey++, category: next, rate: "", cap: "" }]);
              }}
            >
              <Plus /> Add category
            </Button>
          </div>

          {error && <p className="text-xs text-negative">{error}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving" : "Save card"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
