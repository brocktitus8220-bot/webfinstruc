import { z } from "zod";
import { Cents } from "./common";

export const FilingStatus = z.enum([
  "single",
  "married_joint",
  "married_separate",
  "head_of_household",
  "qualifying_surviving_spouse",
]);
export type FilingStatus = z.infer<typeof FilingStatus>;

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  married_joint: "Married filing jointly",
  married_separate: "Married filing separately",
  head_of_household: "Head of household",
  qualifying_surviving_spouse: "Qualifying surviving spouse",
};

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;
export const UsState = z.enum(US_STATES);
export type UsState = z.infer<typeof UsState>;

export const SafeHarborMethod = z.enum(["prior_year_100", "prior_year_110", "current_year_90"]);
export type SafeHarborMethod = z.infer<typeof SafeHarborMethod>;

export const TaxSettings = z.object({
  taxYear: z.number().int().min(2000).max(2100),
  filingStatus: FilingStatus,
  state: UsState,
  /** Blended effective rate used for projections, in percent. */
  estimatedEffectiveRatePercent: z.number().min(0).max(100),
  priorYearTotalTaxCents: Cents.nonnegative(),
  priorYearAgiCents: Cents.nonnegative(),
  safeHarborMethod: SafeHarborMethod,
});
export type TaxSettings = z.infer<typeof TaxSettings>;
