import { z } from "zod";

/** Money is always an integer number of cents. */
export const Cents = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER, "Amount is too large");
export type Cents = z.infer<typeof Cents>;

export const Id = z.string().min(1);

/** Calendar date, YYYY-MM-DD. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Calendar month, YYYY-MM. */
export const IsoMonth = z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM");

export const IsoDateTime = z.string().datetime({ offset: true });

export const CurrencyCode = z.string().length(3).default("USD");
