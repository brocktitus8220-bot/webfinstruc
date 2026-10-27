"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, type PeriodMonths } from "./use-card-analysis";

export function PeriodSelect({ value, onChange }: { value: PeriodMonths; onChange: (m: PeriodMonths) => void }) {
  return (
    <div role="radiogroup" aria-label="Period" className="inline-flex shrink-0 rounded-md border bg-surface p-0.5">
      {PERIOD_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn("whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium", value === m ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {m === 12 ? "1 year" : `${m} months`}
        </button>
      ))}
    </div>
  );
}

/** Period shared by the Overview and Optimize tabs while the page stays open. */
let remembered: PeriodMonths = 3;
export function usePeriod() {
  const [value, setValue] = React.useState<PeriodMonths>(remembered);
  const set = React.useCallback((m: PeriodMonths) => {
    remembered = m;
    setValue(m);
  }, []);
  return [value, set] as const;
}
