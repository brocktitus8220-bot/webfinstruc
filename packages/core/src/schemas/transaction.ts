import { z } from "zod";
import { Cents, Id, IsoDate } from "./common";
import { WorkspaceKind } from "./workspace";

export const TransactionSource = z.enum(["plaid", "manual", "csv", "other"]);
export type TransactionSource = z.infer<typeof TransactionSource>;

export const TransactionKind = z.enum(["income", "expense", "transfer"]);
export type TransactionKind = z.infer<typeof TransactionKind>;

export const Transaction = z.object({
  id: Id,
  workspaceId: Id,
  workspaceKind: WorkspaceKind,
  accountId: Id,
  date: IsoDate,
  /** Signed: positive is money in, negative is money out. */
  amountCents: Cents,
  kind: TransactionKind,
  description: z.string().min(1),
  counterparty: z.string().nullable(),
  category: z.string().min(1),
  source: TransactionSource,
  pending: z.boolean(),
  notes: z.string().nullable(),
});
export type Transaction = z.infer<typeof Transaction>;

/** Input for quick-add dialogs. Amount is entered as a positive number. */
export const CreateTransactionInput = z.object({
  kind: z.enum(["income", "expense"]),
  accountId: Id,
  date: IsoDate,
  amountCents: Cents.positive("Amount must be greater than zero"),
  description: z.string().trim().min(1, "Description is required").max(140),
  counterparty: z.string().trim().max(140).optional(),
  category: z.string().trim().min(1, "Category is required"),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionInput>;
