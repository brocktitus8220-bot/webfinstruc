import { z } from "zod";
import { UserType } from "./user";
import { FilingStatus, UsState } from "./tax";
import { AllocationRules } from "./allocation";

export const ONBOARDING_STEPS = [
  { step: 1, key: "userType", title: "About you" },
  { step: 2, key: "filing", title: "Filing status" },
  { step: 3, key: "accounts", title: "Connect accounts" },
  { step: 4, key: "allocation", title: "Allocation rules" },
  { step: 5, key: "finish", title: "Finish" },
] as const;
export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export const OnboardingUserTypeStep = z.object({ userType: UserType });
export const OnboardingFilingStep = z.object({ filingStatus: FilingStatus, state: UsState });
export const OnboardingAccountsStep = z.object({
  accountsMode: z.enum(["sample", "plaid", "skip"]),
});
export const OnboardingAllocationStep = z.object({ allocationRules: AllocationRules });

export const OnboardingState = z.object({
  userType: UserType.optional(),
  filingStatus: FilingStatus.optional(),
  state: UsState.optional(),
  accountsMode: z.enum(["sample", "plaid", "skip"]).optional(),
  allocationRules: AllocationRules.optional(),
  completedAt: z.string().nullable().default(null),
});
export type OnboardingState = z.infer<typeof OnboardingState>;
