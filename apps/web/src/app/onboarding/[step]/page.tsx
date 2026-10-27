import { notFound } from "next/navigation";
import { ONBOARDING_STEP_COUNT } from "@repo/core";
import { OnboardingStep } from "@/features/onboarding/onboarding-steps";

export function generateStaticParams() {
  return Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => ({ step: String(i + 1) }));
}
export const dynamicParams = false;

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > ONBOARDING_STEP_COUNT) notFound();
  return <OnboardingStep step={step} />;
}
