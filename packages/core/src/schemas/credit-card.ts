import { z } from "zod";
import { AccountConnection } from "./account";
import { Cents, Id, IsoDate } from "./common";
import { WorkspaceKind } from "./workspace";

/**
 * Spending categories that card issuers use for bonus rewards. Transaction
 * categories map onto these with `rewardCategoryFor`.
 */
export const RewardCategory = z.enum([
  "dining",
  "groceries",
  "gas",
  "travel",
  "transit",
  "streaming",
  "online_shopping",
  "drugstores",
  "entertainment",
  "utilities",
  "software",
  "other",
]);
export type RewardCategory = z.infer<typeof RewardCategory>;

export const REWARD_CATEGORY_LABELS: Record<RewardCategory, string> = {
  dining: "Dining",
  groceries: "Groceries",
  gas: "Gas and EV charging",
  travel: "Travel",
  transit: "Transit and rideshare",
  streaming: "Streaming",
  online_shopping: "Shopping",
  drugstores: "Drugstores",
  entertainment: "Entertainment",
  utilities: "Utilities and phone",
  software: "Software and online services",
  other: "Everything else",
};

export const RewardType = z.enum(["cashback", "points", "miles"]);
export type RewardType = z.infer<typeof RewardType>;

/** Basis points: 100 is 1%. Integer, like cents. */
export const BasisPoints = z.number().int().min(0).max(100_000);

/**
 * A bonus rate for one category. The rate is in reward units per dollar,
 * times 100, so 3% cash back and 3x points are both 300.
 */
export const RewardRate = z.object({
  category: RewardCategory,
  rateBasisPoints: BasisPoints,
  /** Yearly spend that earns the bonus rate. Spend above it earns the base rate. */
  annualCapCents: Cents.positive().nullable(),
});
export type RewardRate = z.infer<typeof RewardRate>;

/** What a card earns and costs. Editable, because issuers change terms. */
export const CreditCardProfile = z.object({
  /** Template this profile started from, if any. */
  preset: z.string().nullable(),
  creditLimitCents: Cents.nonnegative().nullable(),
  aprBasisPoints: BasisPoints.nullable(),
  annualFeeCents: Cents.nonnegative(),
  /** Day of month the statement closes, 1 to 31. */
  statementDay: z.number().int().min(1).max(31).nullable(),
  /** Day of month the payment is due, 1 to 31. */
  dueDay: z.number().int().min(1).max(31).nullable(),
  rewardType: RewardType,
  /** What one point or mile is worth, in hundredths of a cent. Cash back is 100. */
  pointValueHundredthsOfCent: z.number().int().min(1).max(10_000),
  baseRateBasisPoints: BasisPoints,
  rates: z.array(RewardRate),
});
export type CreditCardProfile = z.infer<typeof CreditCardProfile>;

/** A credit account plus its rewards profile. */
export const CreditCard = z.object({
  accountId: Id,
  workspaceId: Id,
  workspaceKind: WorkspaceKind,
  name: z.string().min(1),
  institution: z.string().min(1),
  mask: z.string(),
  connection: AccountConnection,
  /** Negative when you owe money, as with every account. */
  balanceCents: Cents,
  profile: CreditCardProfile,
});
export type CreditCard = z.infer<typeof CreditCard>;

/** Body for saving a card's profile. Balance can only be set on non-Plaid cards. */
export const SaveCreditCardInput = CreditCardProfile.extend({
  /** Amount owed right now, as a positive number. Ignored for Plaid cards. */
  owedCents: Cents.nonnegative().optional(),
}).superRefine((v, ctx) => {
  const seen = new Set<string>();
  v.rates.forEach((r, i) => {
    if (seen.has(r.category)) ctx.addIssue({ code: "custom", path: ["rates", i, "category"], message: "Each category can appear once" });
    seen.add(r.category);
  });
});
export type SaveCreditCardInput = z.infer<typeof SaveCreditCardInput>;

/** A profile for cards nobody has set up yet: 1% back on everything. */
export const DEFAULT_CREDIT_CARD_PROFILE: CreditCardProfile = {
  preset: null,
  creditLimitCents: null,
  aprBasisPoints: null,
  annualFeeCents: 0,
  statementDay: null,
  dueDay: null,
  rewardType: "cashback",
  pointValueHundredthsOfCent: 100,
  baseRateBasisPoints: 100,
  rates: [],
};

/** One row of a card statement, already normalized to our sign convention. */
export const StatementRow = z.object({
  date: IsoDate,
  /** Signed: purchases are negative, payments and refunds positive. */
  amountCents: Cents,
  kind: z.enum(["income", "expense", "transfer"]),
  description: z.string().min(1).max(500),
  counterparty: z.string().max(200).nullable(),
  category: z.string().min(1).max(80),
  /** Stable key so the same row imported twice is skipped. */
  externalId: z.string().min(1).max(200),
});
export type StatementRow = z.infer<typeof StatementRow>;

export const ImportStatementInput = z
  .object({
    format: z.enum(["apple_card"]),
    /** Import into this existing credit account... */
    accountId: Id.optional(),
    /** ...or create a new one. */
    newAccount: z
      .object({
        workspaceKind: WorkspaceKind,
        name: z.string().trim().min(1).max(80),
        mask: z.string().regex(/^\d{4}$/, "Use the last 4 digits"),
      })
      .optional(),
    rows: z.array(StatementRow).min(1, "The file has no transactions").max(5_000),
  })
  .refine((v) => Boolean(v.accountId) !== Boolean(v.newAccount), { message: "Pick an account or create a new one" });
export type ImportStatementInput = z.infer<typeof ImportStatementInput>;

export const ImportStatementResult = z.object({
  accountId: Id,
  inserted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type ImportStatementResult = z.infer<typeof ImportStatementResult>;
