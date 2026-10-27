import { assertCents, averageCents } from "../money";
import { median } from "./stats";

export interface BaselineIncomeOptions {
  /**
   * A month is "reliable" when its income is at least this fraction of the
   * median month. Months below it are treated as outliers and ignored.
   * Default 0.2 (20% of the median).
   */
  reliableFractionOfMedian?: number;
}

/**
 * Baseline income: the lowest reliable month. This is the amount a user
 * can plan around even in a slow month. Result is integer cents.
 */
export function baselineIncome(
  monthlyIncomeCents: readonly number[],
  { reliableFractionOfMedian = 0.2 }: BaselineIncomeOptions = {},
): number {
  if (reliableFractionOfMedian < 0 || reliableFractionOfMedian > 1) {
    throw new RangeError("reliableFractionOfMedian must be between 0 and 1");
  }
  monthlyIncomeCents.forEach((v, i) => assertCents(v, `monthlyIncome[${i}]`));
  if (monthlyIncomeCents.length === 0) return 0;
  const threshold = median(monthlyIncomeCents) * reliableFractionOfMedian;
  const reliable = monthlyIncomeCents.filter((v) => v >= threshold);
  return reliable.length === 0 ? 0 : Math.min(...reliable);
}

/** Mean monthly income in integer cents, rounded half away from zero. */
export function averageIncome(monthlyIncomeCents: readonly number[]): number {
  monthlyIncomeCents.forEach((v, idx) => assertCents(v, `monthlyIncome[${idx}]`));
  return averageCents(monthlyIncomeCents);
}
