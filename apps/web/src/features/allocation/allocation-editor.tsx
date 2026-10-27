"use client";
import * as React from "react";
import {
  allocate, ALLOCATION_BUCKET_LABELS, ALLOCATION_BUCKETS, type AllocationBucket, AllocationRules, toBasisPoints,
} from "@repo/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

const EXAMPLE_CENTS = 1_000_000; // $10,000

const HINTS: Record<AllocationBucket, string> = {
  tax: "Set aside for quarterly estimates",
  operating: "Business costs and tools",
  ownerPay: "What you pay yourself",
  savings: "Emergency fund and investing",
};

/** Percent inputs validated by the core AllocationRules schema, with a live preview from allocate(). */
export function AllocationEditor({
  initial, onSubmit, submitLabel = "Save", saving = false, secondaryAction,
}: {
  initial: AllocationRules;
  onSubmit: (rules: AllocationRules) => void;
  submitLabel?: string;
  saving?: boolean;
  secondaryAction?: React.ReactNode;
}) {
  const [values, setValues] = React.useState<Record<AllocationBucket, string>>(() =>
    Object.fromEntries(ALLOCATION_BUCKETS.map((b) => [b, String(initial.find((r) => r.bucket === b)?.percent ?? 0)])) as Record<AllocationBucket, string>,
  );
  const [touched, setTouched] = React.useState(false);

  const rules = ALLOCATION_BUCKETS.map((bucket) => ({ bucket, percent: values[bucket].trim() === "" ? Number.NaN : Number(values[bucket]) }))
    .filter((r) => r.percent !== 0);
  const parsed = AllocationRules.safeParse(rules);
  const totalBps = rules.reduce((s, r) => s + (Number.isFinite(r.percent) ? toBasisPoints(r.percent) : 0), 0);
  const preview = parsed.success ? allocate(EXAMPLE_CENTS, parsed.data) : null;
  const error = parsed.success ? null : parsed.error.issues[0]?.message ?? "Check the percentages";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (parsed.success) onSubmit(parsed.data);
      }}
      className="space-y-4"
    >
      <div className="divide-y rounded-lg border">
        {ALLOCATION_BUCKETS.map((b) => (
          <div key={b} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Label htmlFor={`alloc-${b}`} className="text-sm">{ALLOCATION_BUCKET_LABELS[b]}</Label>
              <p className="text-xs text-muted-foreground">{HINTS[b]}</p>
            </div>
            <div className="relative w-24">
              <Input
                id={`alloc-${b}`}
                inputMode="decimal"
                value={values[b]}
                onChange={(e) => setValues((v) => ({ ...v, [b]: e.target.value }))}
                className="pr-6 text-right tabular"
                aria-invalid={touched && !parsed.success}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <div className="hidden w-24 text-right text-sm tabular text-muted-foreground sm:block">{preview ? money(preview[b]) : "…"}</div>
          </div>
        ))}
        <div className="flex items-center gap-3 bg-subtle px-3 py-2.5 text-sm">
          <span className="flex-1 font-medium">Total</span>
          <span className={cn("w-24 text-right font-semibold tabular", totalBps === 10_000 ? "text-positive" : "text-negative")}>{(totalBps / 100).toFixed(2).replace(/\.00$/, "")}%</span>
          <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">of {money(EXAMPLE_CENTS)}</span>
        </div>
      </div>
      {error && (touched || totalBps !== 10_000) && <p className="text-xs text-negative" role="alert">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {secondaryAction}
        <Button type="submit" disabled={saving}>{saving ? "Saving" : submitLabel}</Button>
      </div>
    </form>
  );
}
