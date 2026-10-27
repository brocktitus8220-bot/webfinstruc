import { assertCents } from "../money";

/**
 * Months of runway: how long the cash balance covers monthly expenses.
 * Returns Infinity when there are no expenses, and 0 when there is no cash.
 */
export function runway(cashBalanceCents: number, monthlyExpensesCents: number): number {
  assertCents(cashBalanceCents, "cashBalance");
  assertCents(monthlyExpensesCents, "monthlyExpenses");
  if (monthlyExpensesCents < 0) throw new RangeError("monthlyExpenses must not be negative");
  if (cashBalanceCents <= 0) return 0;
  if (monthlyExpensesCents === 0) return Number.POSITIVE_INFINITY;
  return cashBalanceCents / monthlyExpensesCents;
}
