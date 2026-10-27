"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Check, Database, Landmark, Lightbulb, Rocket, Sparkles, User } from "lucide-react";
import {
  ALLOCATION_BUCKET_LABELS, DEFAULT_ALLOCATION_RULES, FILING_STATUS_LABELS, FilingStatus, OnboardingFilingStep,
  type OnboardingState, OnboardingUserTypeStep, US_STATES, UserType,
} from "@repo/core";
import { PRODUCT_NAME } from "@repo/core/config";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/lib/api";
import { fieldErrors } from "@/lib/forms";
import { useOnboarding } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AllocationEditor } from "../allocation/allocation-editor";
import { ConnectBankButton } from "../connections/connect-bank-button";
import { plaidDisabledReason, usePlaidStatus } from "../connections/use-plaid-connect";

type Patch = Partial<OnboardingState>;

function useStepSave(step: number) {
  const router = useRouter();
  const mutation = useApiMutation((api, body: Patch) => api.saveOnboarding({ body }));
  const next = (body: Patch, href = `/onboarding/${step + 1}`) => mutation.mutate(body, { onSuccess: () => router.push(href) });
  return { next, saving: mutation.isPending };
}

function StepFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function BackLink({ step }: { step: number }) {
  if (step <= 1) return <span />;
  return (
    <Button asChild variant="ghost">
      <Link href={`/onboarding/${step - 1}`}><ArrowLeft /> Back</Link>
    </Button>
  );
}

const USER_TYPES: { value: UserType; label: string; description: string; icon: typeof User }[] = [
  { value: "freelancer", label: "Freelancer or consultant", description: "Client work, invoices, uneven months", icon: Briefcase },
  { value: "founder", label: "Founder", description: "Running an early company and paying yourself", icon: Rocket },
  { value: "creator", label: "Creator", description: "Sponsorships, platform payouts, product sales", icon: Lightbulb },
  { value: "other", label: "Something else", description: "Any income that changes month to month", icon: User },
];

function UserTypeStep({ state }: { state: OnboardingState }) {
  const [value, setValue] = React.useState<UserType | undefined>(state.userType);
  const [error, setError] = React.useState<string>();
  const { next, saving } = useStepSave(1);
  return (
    <StepFrame title="What kind of work do you do?" description={`${PRODUCT_NAME} tunes its defaults to how your income arrives.`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = OnboardingUserTypeStep.safeParse({ userType: value });
          if (!parsed.success) return setError("Choose one to continue");
          next(parsed.data);
        }}
      >
        <div role="radiogroup" aria-label="User type" className="grid gap-2 sm:grid-cols-2">
          {USER_TYPES.map((t) => {
            const active = value === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => { setValue(t.value); setError(undefined); }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border bg-surface p-3 text-left transition-colors hover:border-primary/50",
                  active && "border-primary ring-1 ring-primary/30",
                )}
              >
                <t.icon className={cn("mt-0.5 size-4", active ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.description}</span>
                </span>
                {active && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-2 text-xs text-negative">{error}</p>}
        <div className="mt-6 flex justify-between"><BackLink step={1} /><Button type="submit" disabled={saving}>Continue</Button></div>
      </form>
    </StepFrame>
  );
}

function FilingStep({ state }: { state: OnboardingState }) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { next, saving } = useStepSave(2);
  return (
    <StepFrame title="Filing status and state" description="Used to estimate quarterly taxes. You can change this later in Settings.">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const parsed = OnboardingFilingStep.safeParse({ filingStatus: f.get("filingStatus") || undefined, state: f.get("state") || undefined });
          if (!parsed.success) return setErrors(fieldErrors(parsed.error));
          next(parsed.data);
        }}
        className="space-y-4"
      >
        <Field id="ob-filing" label="Filing status" error={errors.filingStatus && "Choose a filing status"}>
          <NativeSelect id="ob-filing" name="filingStatus" defaultValue={state.filingStatus ?? ""}>
            <option value="" disabled>Select</option>
            {FilingStatus.options.map((s) => <option key={s} value={s}>{FILING_STATUS_LABELS[s]}</option>)}
          </NativeSelect>
        </Field>
        <Field id="ob-state" label="State of residence" error={errors.state && "Choose a state"}>
          <NativeSelect id="ob-state" name="state" defaultValue={state.state ?? ""}>
            <option value="" disabled>Select</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
        </Field>
        <div className="flex justify-between pt-2"><BackLink step={2} /><Button type="submit" disabled={saving}>Continue</Button></div>
      </form>
    </StepFrame>
  );
}

function AccountsStep({ state }: { state: OnboardingState }) {
  const { next, saving } = useStepSave(3);
  const status = usePlaidStatus();
  const reason = status.isLoading ? null : plaidDisabledReason(status.data?.enabled);
  const [connected, setConnected] = React.useState<string[]>([]);
  return (
    <StepFrame title="Connect your accounts" description="Link the accounts your income lands in, or explore with sample data first.">
      <div className="space-y-2">
        <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-4", (state.accountsMode === "plaid" || connected.length > 0) && "border-primary ring-1 ring-primary/30")}>
          <Landmark className={cn("size-5", reason ? "text-muted-foreground" : "text-primary")} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Connect a bank or card</div>
            <div className="text-xs text-muted-foreground">
              {connected.length > 0
                ? `Connected ${connected.join(", ")}. Add another, or continue.`
                : (reason ?? "Secure, read-only connection through Plaid. We never see your bank password.")}
            </div>
          </div>
          <ConnectBankButton
            variant="outline"
            label={connected.length > 0 ? "Add another" : "Connect with Plaid"}
            onConnected={(c) => setConnected((list) => [...list, c.institutionName])}
          />
          {connected.length > 0 && <Button onClick={() => next({ accountsMode: "plaid" })} disabled={saving}>Continue</Button>}
        </div>
        <div className={cn("flex items-center gap-3 rounded-lg border bg-surface p-4", state.accountsMode === "sample" && "border-primary ring-1 ring-primary/30")}>
          <Database className="size-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-medium">Use sample data</div>
            <div className="text-xs text-muted-foreground">Three cash accounts and a year of irregular income. Replace it any time.</div>
          </div>
          <Button onClick={() => next({ accountsMode: "sample" })} disabled={saving}>Use sample data</Button>
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <BackLink step={3} />
        <Button variant="ghost" onClick={() => next({ accountsMode: "skip" })} disabled={saving}>Skip for now</Button>
      </div>
    </StepFrame>
  );
}

function AllocationStep({ state }: { state: OnboardingState }) {
  const { next, saving } = useStepSave(4);
  return (
    <StepFrame title="Default allocation rules" description="When money comes in, split it into buckets. These must add up to 100%.">
      <AllocationEditor
        initial={state.allocationRules ?? DEFAULT_ALLOCATION_RULES}
        submitLabel="Continue"
        saving={saving}
        onSubmit={(allocationRules) => next({ allocationRules })}
        secondaryAction={<span className="mr-auto"><BackLink step={4} /></span>}
      />
    </StepFrame>
  );
}

function FinishStep({ state }: { state: OnboardingState }) {
  const { next, saving } = useStepSave(5);
  const rules = state.allocationRules ?? DEFAULT_ALLOCATION_RULES;
  const summary: [string, string][] = [
    ["Work", USER_TYPES.find((t) => t.value === state.userType)?.label ?? "Not set"],
    ["Filing", state.filingStatus ? `${FILING_STATUS_LABELS[state.filingStatus]}, ${state.state ?? ""}` : "Not set"],
    ["Accounts", state.accountsMode === "sample" ? "Sample data" : state.accountsMode === "plaid" ? "Connected through Plaid" : state.accountsMode === "skip" ? "Skipped for now" : "Not set"],
    ["Allocation", rules.map((r) => `${ALLOCATION_BUCKET_LABELS[r.bucket]} ${r.percent}%`).join(", ")],
  ];
  return (
    <StepFrame title="You are all set" description="Here is what we will use to build your dashboard.">
      <dl className="divide-y rounded-lg border bg-surface">
        {summary.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-3 px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex justify-between">
        <BackLink step={5} />
        <Button onClick={() => next({ completedAt: new Date().toISOString() }, "/app/overview")} disabled={saving}>
          <Sparkles /> Go to dashboard
        </Button>
      </div>
    </StepFrame>
  );
}

const STEPS = [UserTypeStep, FilingStep, AccountsStep, AllocationStep, FinishStep];

export function OnboardingStep({ step }: { step: number }) {
  const onboarding = useOnboarding();
  const Step = STEPS[step - 1];
  if (!Step) return null;
  if (onboarding.isLoading || !onboarding.data) return <Skeleton className="h-72 w-full" />;
  return <Step state={onboarding.data} />;
}
