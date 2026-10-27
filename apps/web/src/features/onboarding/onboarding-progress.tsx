"use client";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { ONBOARDING_STEP_COUNT, ONBOARDING_STEPS } from "@repo/core";
import { cn } from "@/lib/utils";

export function OnboardingProgress() {
  const params = useParams<{ step: string }>();
  const current = Number(params.step) || 1;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {current} of {ONBOARDING_STEP_COUNT}</span>
        <span>{ONBOARDING_STEPS[current - 1]?.title}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={ONBOARDING_STEP_COUNT} aria-valuenow={current}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(current / ONBOARDING_STEP_COUNT) * 100}%` }} />
      </div>
      <ol className="mt-3 hidden grid-cols-5 gap-2 sm:grid">
        {ONBOARDING_STEPS.map((s) => {
          const done = s.step < current;
          const active = s.step === current;
          return (
            <li key={s.step} className={cn("flex items-center gap-1.5 text-xs", active ? "font-medium text-foreground" : "text-muted-foreground")}>
              <span className={cn("flex size-4 items-center justify-center rounded-full border text-2xs", done && "border-primary bg-primary text-primary-foreground", active && "border-primary text-primary")}>
                {done ? <Check className="size-2.5" strokeWidth={3} /> : s.step}
              </span>
              <span className="truncate">{s.title}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
