import { z } from "zod";
import { Cents, Id } from "./common";

export const Holding = z.object({
  id: Id,
  accountId: Id,
  symbol: z.string().min(1),
  name: z.string().min(1),
  assetClass: z.enum(["equity", "fixed_income", "cash", "fund", "other"]),
  /** Thousandths of a share, to keep quantities integer. */
  quantityMilli: z.number().int(),
  priceCents: Cents,
  marketValueCents: Cents,
  costBasisCents: Cents,
});
export type Holding = z.infer<typeof Holding>;
