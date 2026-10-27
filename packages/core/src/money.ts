/** Helpers for integer-cent money. Never store or compute money as floats. */

export function assertCents(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of cents, got ${value}`);
  }
}

export interface FormatCurrencyOptions {
  currency?: string;
  locale?: string;
  /** Hide the cents part (rounds to the nearest whole unit). */
  wholeUnits?: boolean;
  /** Compact notation, for example $12.4K. */
  compact?: boolean;
  /** "always" shows a plus sign on positive values. */
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(cents: number, options: FormatCurrencyOptions = {}): string {
  assertCents(cents);
  const { currency = "USD", locale = "en-US", wholeUnits = false, compact = false, signDisplay = "auto" } = options;
  const key = JSON.stringify([currency, locale, wholeUnits, compact, signDisplay]);
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      signDisplay,
      ...(compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : wholeUnits
          ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
          : {}),
    });
    formatterCache.set(key, fmt);
  }
  // Division happens only at the display edge.
  return fmt.format(cents / 100);
}

/**
 * Parse user input like "1,234.5" or "$12" into integer cents.
 * Returns null when the input is not a valid amount.
 */
export function parseCurrencyToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const [whole = "0", frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total, "total");
  return total;
}

/** Mean of integer-cent values, rounded half away from zero. Empty list gives 0. */
export function averageCents(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const avg = sumCents(values) / values.length;
  return Math.sign(avg) * Math.round(Math.abs(avg));
}
