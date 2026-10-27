import { z } from "zod";
import { Cents, CurrencyCode, Id } from "./common";
import { WorkspaceKind } from "./workspace";

export const AccountType = z.enum(["checking", "savings", "credit", "brokerage", "retirement"]);
export type AccountType = z.infer<typeof AccountType>;

/** How an account got here: sample data, a Plaid connection, a statement import, or typed in. */
export const AccountConnection = z.enum(["sample", "plaid", "csv", "manual"]);
export type AccountConnection = z.infer<typeof AccountConnection>;

export const Account = z.object({
  id: Id,
  workspaceId: Id,
  workspaceKind: WorkspaceKind,
  name: z.string().min(1),
  institution: z.string().min(1),
  type: AccountType,
  connection: AccountConnection,
  mask: z.string().regex(/^\d{4}$/),
  /**
   * Signed like transactions: positive is money you have, negative is money
   * you owe. A credit card with $400 owed has balanceCents -40000.
   */
  balanceCents: Cents,
  currency: CurrencyCode,
  /** Name of the third-party custodian holding the assets, if any. */
  custodian: z.string().nullable(),
});
export type Account = z.infer<typeof Account>;

/** Cash accounts drive balance, runway, and the header account selector. */
export const CASH_ACCOUNT_TYPES: readonly AccountType[] = ["checking", "savings"];
export const isCashAccount = (a: Pick<Account, "type">) => CASH_ACCOUNT_TYPES.includes(a.type);

export const isCreditAccount = (a: Pick<Account, "type">) => a.type === "credit";

/** Account types whose balance is the sum of their holdings. */
export const INVESTMENT_ACCOUNT_TYPES: readonly AccountType[] = ["brokerage", "retirement"];
export const isInvestmentAccount = (a: Pick<Account, "type">) => INVESTMENT_ACCOUNT_TYPES.includes(a.type);
