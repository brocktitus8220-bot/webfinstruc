import { z } from "zod";
import { Cents, CurrencyCode, Id } from "./common";
import { WorkspaceKind } from "./workspace";

export const AccountType = z.enum(["checking", "savings", "credit", "brokerage", "retirement"]);
export type AccountType = z.infer<typeof AccountType>;

export const Account = z.object({
  id: Id,
  workspaceId: Id,
  workspaceKind: WorkspaceKind,
  name: z.string().min(1),
  institution: z.string().min(1),
  type: AccountType,
  mask: z.string().regex(/^\d{4}$/),
  balanceCents: Cents,
  currency: CurrencyCode,
  /** Name of the third-party custodian holding the assets, if any. */
  custodian: z.string().nullable(),
});
export type Account = z.infer<typeof Account>;

/** Cash accounts drive balance, runway, and the header account selector. */
export const CASH_ACCOUNT_TYPES: readonly AccountType[] = ["checking", "savings"];
export const isCashAccount = (a: Pick<Account, "type">) => CASH_ACCOUNT_TYPES.includes(a.type);
