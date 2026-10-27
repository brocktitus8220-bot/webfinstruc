/**
 * Database schema. Mirrors the Zod schemas in @repo/core.
 *
 * Rules:
 * - Money is integer cents in bigint columns, read as JS numbers.
 * - Percentages are integer basis points (12.5% is 1250).
 * - Enum values come from the core Zod enums, so the two never drift.
 * - Every row belongs to a user, directly or through a workspace.
 */
import {
  AccountType,
  AllocationBucket,
  FilingStatus,
  InvoiceStatus,
  SafeHarborMethod,
  TransactionKind,
  TransactionSource,
  US_STATES,
  UserType,
  WorkspaceKind,
} from "@repo/core";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const cents = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const userTypeEnum = pgEnum("user_type", UserType.options);
export const workspaceKindEnum = pgEnum("workspace_kind", WorkspaceKind.options);
export const accountTypeEnum = pgEnum("account_type", AccountType.options);
export const transactionKindEnum = pgEnum("transaction_kind", TransactionKind.options);
export const transactionSourceEnum = pgEnum("transaction_source", TransactionSource.options);
export const invoiceStatusEnum = pgEnum("invoice_status", InvoiceStatus.options);
export const assetClassEnum = pgEnum("asset_class", ["equity", "fixed_income", "cash", "fund", "other"]);
export const allocationBucketEnum = pgEnum("allocation_bucket", AllocationBucket.options);
export const filingStatusEnum = pgEnum("filing_status", FilingStatus.options);
export const usStateEnum = pgEnum("us_state", US_STATES);
export const safeHarborMethodEnum = pgEnum("safe_harbor_method", SafeHarborMethod.options);
export const accountsModeEnum = pgEnum("accounts_mode", ["sample", "plaid", "skip"]);

/** One row per signed-in person. The id is the auth provider's user id. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  userType: userTypeEnum("user_type"),
  createdAt: createdAt(),
});

/** Each user has at most one business and one personal workspace. */
export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: workspaceKindEnum("kind").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("workspaces_user_kind_idx").on(t.userId, t.kind)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institution: text("institution").notNull(),
    type: accountTypeEnum("type").notNull(),
    mask: text("mask").notNull(),
    /** Current balance for cash and credit accounts. Investment balances come from holdings. */
    balanceCents: cents("balance_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    custodian: text("custodian"),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_workspace_idx").on(t.workspaceId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    /** Signed: positive is money in, negative is money out. */
    amountCents: cents("amount_cents").notNull(),
    kind: transactionKindEnum("kind").notNull(),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    category: text("category").notNull(),
    source: transactionSourceEnum("source").notNull(),
    pending: boolean("pending").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("transactions_workspace_date_idx").on(t.workspaceId, t.date),
    index("transactions_account_date_idx").on(t.accountId, t.date),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    client: text("client").notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    amountCents: cents("amount_cents").notNull(),
    status: invoiceStatusEnum("status").notNull(),
    paidDate: date("paid_date", { mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_workspace_idx").on(t.workspaceId),
    uniqueIndex("invoices_workspace_number_idx").on(t.workspaceId, t.number),
  ],
);

export const holdings = pgTable(
  "holdings",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    assetClass: assetClassEnum("asset_class").notNull(),
    /** Thousandths of a share, to keep quantities integer. */
    quantityMilli: bigint("quantity_milli", { mode: "number" }).notNull(),
    priceCents: cents("price_cents").notNull(),
    marketValueCents: cents("market_value_cents").notNull(),
    costBasisCents: cents("cost_basis_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("holdings_account_idx").on(t.accountId)],
);

/** Onboarding answers, one row per user. Allocation rules live in their own table. */
export const onboarding = pgTable("onboarding", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  filingStatus: filingStatusEnum("filing_status"),
  state: usStateEnum("state"),
  accountsMode: accountsModeEnum("accounts_mode"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const allocationRules = pgTable(
  "allocation_rules",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bucket: allocationBucketEnum("bucket").notNull(),
    basisPoints: integer("basis_points").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bucket] })],
);

export const taxSettings = pgTable("tax_settings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  taxYear: integer("tax_year").notNull(),
  filingStatus: filingStatusEnum("filing_status").notNull(),
  state: usStateEnum("state").notNull(),
  effectiveRateBasisPoints: integer("effective_rate_basis_points").notNull(),
  priorYearTotalTaxCents: cents("prior_year_total_tax_cents").notNull(),
  priorYearAgiCents: cents("prior_year_agi_cents").notNull(),
  safeHarborMethod: safeHarborMethodEnum("safe_harbor_method").notNull(),
});
