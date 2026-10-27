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
  AccountConnection,
  AccountType,
  AllocationBucket,
  ConnectionStatus,
  FilingStatus,
  InvoiceStatus,
  RewardCategory,
  RewardType,
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
export const accountConnectionEnum = pgEnum("account_connection", AccountConnection.options);
export const connectionStatusEnum = pgEnum("connection_status", ConnectionStatus.options);
export const rewardTypeEnum = pgEnum("reward_type", RewardType.options);
export const rewardCategoryEnum = pgEnum("reward_category", RewardCategory.options);
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

/**
 * One bank login through Plaid (a Plaid "Item"). The access token is
 * encrypted with PLAID_TOKEN_KEY before it is stored and never leaves the server.
 */
export const plaidItems = pgTable(
  "plaid_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    plaidItemId: text("plaid_item_id").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    institutionName: text("institution_name").notNull(),
    status: connectionStatusEnum("status").notNull().default("active"),
    errorCode: text("error_code"),
    /** transactions/sync cursor. Null until the first sync. */
    cursor: text("cursor"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("plaid_items_plaid_item_idx").on(t.plaidItemId), index("plaid_items_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institution: text("institution").notNull(),
    type: accountTypeEnum("type").notNull(),
    connection: accountConnectionEnum("connection").notNull().default("manual"),
    /** Set while the account is linked through Plaid. Disconnecting keeps the account and its history. */
    plaidItemId: text("plaid_item_id").references(() => plaidItems.id, { onDelete: "set null" }),
    plaidAccountId: text("plaid_account_id"),
    mask: text("mask").notNull(),
    /**
     * Current balance for cash and credit accounts, signed: negative is owed.
     * Investment balances come from holdings.
     */
    balanceCents: cents("balance_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    custodian: text("custodian"),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_workspace_idx").on(t.workspaceId), uniqueIndex("accounts_plaid_account_idx").on(t.plaidAccountId)],
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
    /** Id from the source (Plaid transaction_id, or a statement row key). Used to skip duplicates. */
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("transactions_workspace_date_idx").on(t.workspaceId, t.date),
    index("transactions_account_date_idx").on(t.accountId, t.date),
    uniqueIndex("transactions_account_external_idx").on(t.accountId, t.externalId),
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

/** Rewards and terms for a credit card account. Missing row means the default profile. */
export const creditCardProfiles = pgTable("credit_card_profiles", {
  accountId: text("account_id").primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  preset: text("preset"),
  creditLimitCents: cents("credit_limit_cents"),
  aprBasisPoints: integer("apr_basis_points"),
  annualFeeCents: cents("annual_fee_cents").notNull().default(0),
  statementDay: integer("statement_day"),
  dueDay: integer("due_day"),
  rewardType: rewardTypeEnum("reward_type").notNull(),
  /** Value of one point or mile in hundredths of a cent. Cash back is 100. */
  pointValueHundredthsOfCent: integer("point_value_hundredths_of_cent").notNull(),
  baseRateBasisPoints: integer("base_rate_basis_points").notNull(),
});

/** Bonus earn rates per category. 300 basis points is 3% or 3x. */
export const creditCardRewardRates = pgTable(
  "credit_card_reward_rates",
  {
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    category: rewardCategoryEnum("category").notNull(),
    rateBasisPoints: integer("rate_basis_points").notNull(),
    annualCapCents: cents("annual_cap_cents"),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.category] })],
);
