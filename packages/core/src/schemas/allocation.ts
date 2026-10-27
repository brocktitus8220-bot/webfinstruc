import { z } from "zod";

export const AllocationBucket = z.enum(["tax", "operating", "ownerPay", "savings"]);
export type AllocationBucket = z.infer<typeof AllocationBucket>;

/** Fixed order used for display and for deterministic rounding. */
export const ALLOCATION_BUCKETS: readonly AllocationBucket[] = AllocationBucket.options;

export const ALLOCATION_BUCKET_LABELS: Record<AllocationBucket, string> = {
  tax: "Tax set-aside",
  operating: "Operating",
  ownerPay: "Owner pay",
  savings: "Savings and investing",
};

/** Percent with at most two decimal places, 0 to 100. */
export const Percent = z
  .number()
  .min(0, "Must be 0 or more")
  .max(100, "Must be 100 or less")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Use at most two decimals");

export const AllocationRule = z.object({
  bucket: AllocationBucket,
  percent: Percent,
});
export type AllocationRule = z.infer<typeof AllocationRule>;

export const toBasisPoints = (percent: number) => Math.round(percent * 100);

export const AllocationRules = z
  .array(AllocationRule)
  .min(1)
  .superRefine((rules, ctx) => {
    const seen = new Set<AllocationBucket>();
    for (const r of rules) {
      if (seen.has(r.bucket)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate bucket: ${r.bucket}` });
      }
      seen.add(r.bucket);
    }
    const total = rules.reduce((sum, r) => sum + toBasisPoints(r.percent), 0);
    if (total !== 10_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Percentages must add up to 100 (currently ${total / 100})`,
      });
    }
  });
export type AllocationRules = z.infer<typeof AllocationRules>;

export const DEFAULT_ALLOCATION_RULES: AllocationRules = [
  { bucket: "tax", percent: 30 },
  { bucket: "operating", percent: 30 },
  { bucket: "ownerPay", percent: 30 },
  { bucket: "savings", percent: 10 },
];
