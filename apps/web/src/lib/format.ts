import { formatCurrency } from "@repo/core";

export const money = (cents: number) => formatCurrency(cents);
export const moneyWhole = (cents: number) => formatCurrency(cents, { wholeUnits: true });
export const moneyCompact = (cents: number) => formatCurrency(cents, { compact: true });

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", opts);

export const formatMonth = (isoMonth: string) =>
  new Date(`${isoMonth}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

export const formatMonths = (months: number) =>
  Number.isFinite(months) ? `${months.toFixed(1)} mo` : "No burn";

export const formatPercent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;
