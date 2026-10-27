import { assertCents } from "../money";
import {
  ALLOCATION_BUCKETS,
  type AllocationBucket,
  type AllocationRule,
  toBasisPoints,
} from "../schemas/allocation";

export class AllocationError extends Error {
  override name = "AllocationError";
}

export type AllocationResult = Record<AllocationBucket, number>;

/**
 * Split an amount (integer cents) across allocation buckets.
 *
 * - Percentages must sum to exactly 100, otherwise this throws.
 * - All math is integer: percents become basis points, each bucket gets
 *   floor(amount * bps / 10000), and leftover cents go one at a time to the
 *   buckets with the largest remainder. Ties break by the fixed bucket order
 *   (tax, operating, ownerPay, savings), so results are deterministic.
 * - Buckets with no rule receive 0.
 */
export function allocate(amountCents: number, rules: readonly AllocationRule[]): AllocationResult {
  assertCents(amountCents, "amount");
  if (amountCents < 0) throw new AllocationError("amount must not be negative");
  if (rules.length === 0) throw new AllocationError("at least one rule is required");

  const seen = new Set<AllocationBucket>();
  let totalBps = 0;
  for (const rule of rules) {
    if (!ALLOCATION_BUCKETS.includes(rule.bucket)) throw new AllocationError(`unknown bucket: ${rule.bucket}`);
    if (seen.has(rule.bucket)) throw new AllocationError(`duplicate bucket: ${rule.bucket}`);
    seen.add(rule.bucket);
    if (!Number.isFinite(rule.percent) || rule.percent < 0) {
      throw new AllocationError(`invalid percent for ${rule.bucket}`);
    }
    const bps = toBasisPoints(rule.percent);
    if (Math.abs(rule.percent * 100 - bps) > 1e-9) {
      throw new AllocationError(`percent for ${rule.bucket} has more than two decimals`);
    }
    totalBps += bps;
  }
  if (totalBps !== 10_000) {
    throw new AllocationError(`percentages must sum to 100, got ${totalBps / 100}`);
  }
  if (!Number.isSafeInteger(amountCents * 10_000)) throw new AllocationError("amount is too large");

  const result: AllocationResult = { tax: 0, operating: 0, ownerPay: 0, savings: 0 };
  const remainders: { bucket: AllocationBucket; remainder: number; order: number }[] = [];
  let distributed = 0;

  for (const rule of rules) {
    const scaled = amountCents * toBasisPoints(rule.percent);
    const share = Math.floor(scaled / 10_000);
    result[rule.bucket] = share;
    distributed += share;
    remainders.push({ bucket: rule.bucket, remainder: scaled % 10_000, order: ALLOCATION_BUCKETS.indexOf(rule.bucket) });
  }

  let leftover = amountCents - distributed;
  remainders.sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (let i = 0; leftover > 0; i = (i + 1) % remainders.length) {
    result[remainders[i]!.bucket] += 1;
    leftover -= 1;
  }
  return result;
}
