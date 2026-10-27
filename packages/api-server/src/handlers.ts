import { and, asc, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import {
  type Account,
  AccountType,
  ALLOCATION_BUCKETS,
  type AllocationRules,
  type BankConnection,
  type CreditCard,
  type CreditCardProfile,
  DEFAULT_ALLOCATION_RULES,
  DEFAULT_CREDIT_CARD_PROFILE,
  findCreditCardPreset,
  type Holding,
  type Invoice,
  isCashAccount,
  type OnboardingState,
  type TaxSettings,
  type Transaction,
  type WorkspaceKind,
  type WorkspaceScope,
  toBasisPoints,
} from "@repo/core";
import type { EndpointName, EndpointResponse, ParsedRequest } from "@repo/api-client";
import { type Database, schema } from "@repo/db";
import { HttpError } from "./errors";
import { newId } from "./ids";
import { decryptToken, encryptToken, PlaidApiError, type PlaidService, syncPlaidItem } from "./plaid";
import { getWorkspaceId } from "./provision";
import { seedSampleData } from "./seed";

export interface HandlerContext {
  db: Database;
  userId: string;
  workspace: WorkspaceScope;
  now: Date;
  /** Null when Plaid keys are not configured. */
  plaid: PlaidService | null;
}

export type Handlers = {
  [N in EndpointName]: (req: ParsedRequest<N>, ctx: HandlerContext) => Promise<EndpointResponse<N>>;
};

const {
  accounts, allocationRules, creditCardProfiles, creditCardRewardRates, holdings, invoices, onboarding, plaidItems, taxSettings,
  transactions, users, workspaces,
} = schema;

/** Account types whose balance is the sum of their holdings. */
const INVESTMENT_TYPES = new Set<Account["type"]>(["brokerage", "retirement"]);
const ACCOUNT_TYPE_ORDER = AccountType.options;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utcDay = (d: Date, offsetDays = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
const monthStart = (d: Date, offset = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));

const fromBasisPoints = (bp: number) => bp / 100;

/** Workspaces of this user that the scope covers. */
async function scopedWorkspaces(ctx: HandlerContext) {
  const rows = await ctx.db
    .select({ id: workspaces.id, kind: workspaces.kind, name: workspaces.name })
    .from(workspaces)
    .where(
      ctx.workspace === "all"
        ? eq(workspaces.userId, ctx.userId)
        : and(eq(workspaces.userId, ctx.userId), eq(workspaces.kind, ctx.workspace)),
    )
    .orderBy(asc(workspaces.kind));
  return { rows, ids: rows.map((w) => w.id), kindOf: new Map(rows.map((w) => [w.id, w.kind as WorkspaceKind])) };
}

/** Accounts in scope, with investment balances computed from holdings. */
async function scopedAccounts(ctx: HandlerContext): Promise<Account[]> {
  const ws = await scopedWorkspaces(ctx);
  if (ws.ids.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(accounts)
    .where(inArray(accounts.workspaceId, ws.ids));
  if (rows.length === 0) return [];
  // Business first, then cash before credit before investments, then by name.
  rows.sort(
    (a, b) =>
      ws.kindOf.get(a.workspaceId)!.localeCompare(ws.kindOf.get(b.workspaceId)!) ||
      ACCOUNT_TYPE_ORDER.indexOf(a.type) - ACCOUNT_TYPE_ORDER.indexOf(b.type) ||
      a.name.localeCompare(b.name),
  );

  const values = await ctx.db
    .select({ accountId: holdings.accountId, total: sql<string>`coalesce(sum(${holdings.marketValueCents}), 0)` })
    .from(holdings)
    .where(inArray(holdings.accountId, rows.map((a) => a.id)))
    .groupBy(holdings.accountId);
  const holdingValue = new Map(values.map((v) => [v.accountId, Number(v.total)]));

  return rows.map((a) => ({
    id: a.id,
    workspaceId: a.workspaceId,
    workspaceKind: ws.kindOf.get(a.workspaceId)!,
    name: a.name,
    institution: a.institution,
    type: a.type,
    connection: a.connection,
    mask: a.mask,
    balanceCents: INVESTMENT_TYPES.has(a.type) ? (holdingValue.get(a.id) ?? 0) : a.balanceCents,
    currency: a.currency,
    custodian: a.custodian,
  }));
}

type TransactionRow = typeof transactions.$inferSelect;
const toTransaction = (t: TransactionRow, kind: WorkspaceKind): Transaction => ({
  id: t.id,
  workspaceId: t.workspaceId,
  workspaceKind: kind,
  accountId: t.accountId,
  date: t.date,
  amountCents: t.amountCents,
  kind: t.kind,
  description: t.description,
  counterparty: t.counterparty,
  category: t.category,
  source: t.source,
  pending: t.pending,
  notes: t.notes,
});

type InvoiceRow = typeof invoices.$inferSelect;
const toInvoice = (i: InvoiceRow): Invoice => ({
  id: i.id,
  workspaceId: i.workspaceId,
  number: i.number,
  client: i.client,
  issueDate: i.issueDate,
  dueDate: i.dueDate,
  amountCents: i.amountCents,
  status: i.status,
  paidDate: i.paidDate,
});

type HoldingRow = typeof holdings.$inferSelect;
const toHolding = ({ createdAt: _createdAt, ...h }: HoldingRow): Holding => h;

async function readAllocationRules(db: Database, userId: string): Promise<AllocationRules | null> {
  const rows = await db.select().from(allocationRules).where(eq(allocationRules.userId, userId));
  if (rows.length === 0) return null;
  const order = (b: string) => ALLOCATION_BUCKETS.indexOf(b as (typeof ALLOCATION_BUCKETS)[number]);
  return rows
    .sort((a, b) => order(a.bucket) - order(b.bucket))
    .map((r) => ({ bucket: r.bucket, percent: fromBasisPoints(r.basisPoints) }));
}

async function writeAllocationRules(db: Database, userId: string, rules: AllocationRules) {
  await db.transaction(async (tx) => {
    await tx.delete(allocationRules).where(eq(allocationRules.userId, userId));
    await tx.insert(allocationRules).values(rules.map((r) => ({ userId, bucket: r.bucket, basisPoints: toBasisPoints(r.percent) })));
  });
}

async function readOnboarding(db: Database, userId: string): Promise<OnboardingState> {
  const [user] = await db.select({ userType: users.userType }).from(users).where(eq(users.id, userId));
  const [row] = await db.select().from(onboarding).where(eq(onboarding.userId, userId));
  const rules = await readAllocationRules(db, userId);
  const state: OnboardingState = { completedAt: row?.completedAt ? row.completedAt.toISOString() : null };
  if (user?.userType) state.userType = user.userType;
  if (row?.filingStatus) state.filingStatus = row.filingStatus;
  if (row?.state) state.state = row.state;
  if (row?.accountsMode) state.accountsMode = row.accountsMode;
  if (rules) state.allocationRules = rules;
  return state;
}

const notFound = (what: string): never => {
  throw new HttpError(404, `${what} not found`);
};

/** Card profiles and bonus rates for these accounts. Missing profiles fall back to the default. */
async function readCardProfiles(db: Database, accountIds: string[]): Promise<Map<string, CreditCardProfile>> {
  const out = new Map<string, CreditCardProfile>();
  if (accountIds.length === 0) return out;
  const profiles = await db.select().from(creditCardProfiles).where(inArray(creditCardProfiles.accountId, accountIds));
  const rates = await db.select().from(creditCardRewardRates).where(inArray(creditCardRewardRates.accountId, accountIds));
  for (const { accountId, ...p } of profiles) {
    out.set(accountId, {
      ...p,
      rates: rates
        .filter((r) => r.accountId === accountId)
        .map((r) => ({ category: r.category, rateBasisPoints: r.rateBasisPoints, annualCapCents: r.annualCapCents })),
    });
  }
  return out;
}

async function writeCardProfile(db: Database, accountId: string, profile: CreditCardProfile) {
  const { rates, ...row } = profile;
  await db.transaction(async (tx) => {
    await tx.insert(creditCardProfiles).values({ accountId, ...row }).onConflictDoUpdate({ target: creditCardProfiles.accountId, set: row });
    await tx.delete(creditCardRewardRates).where(eq(creditCardRewardRates.accountId, accountId));
    if (rates.length > 0) await tx.insert(creditCardRewardRates).values(rates.map((r) => ({ accountId, ...r })));
  });
}

const toCreditCard = (a: Account, profile: CreditCardProfile | undefined): CreditCard => ({
  accountId: a.id,
  workspaceId: a.workspaceId,
  workspaceKind: a.workspaceKind,
  name: a.name,
  institution: a.institution,
  mask: a.mask,
  connection: a.connection,
  balanceCents: a.balanceCents,
  profile: profile ?? DEFAULT_CREDIT_CARD_PROFILE,
});

/** One of this user's accounts, whatever workspace is selected. */
async function ownedAccount(db: Database, userId: string, accountId: string) {
  const [row] = await db
    .select({ account: accounts, kind: workspaces.kind })
    .from(accounts)
    .innerJoin(workspaces, eq(accounts.workspaceId, workspaces.id))
    .where(and(eq(accounts.id, accountId), eq(workspaces.userId, userId)));
  return row ?? null;
}

const requirePlaid = (ctx: HandlerContext): PlaidService => {
  if (!ctx.plaid) throw new HttpError(503, "Bank connections are not set up on this server. Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_TOKEN_KEY.");
  return ctx.plaid;
};

/** Plaid errors become 502s with Plaid's message, so the UI can show what went wrong. */
async function withPlaidErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PlaidApiError) throw new HttpError(502, error.message, { plaidErrorCode: error.errorCode });
    throw error;
  }
}

async function ownedItem(ctx: HandlerContext, id: string) {
  const [item] = await ctx.db.select().from(plaidItems).where(and(eq(plaidItems.id, id), eq(plaidItems.userId, ctx.userId)));
  return item ?? notFound("Connection");
}

async function listUserConnections(ctx: HandlerContext, onlyId?: string): Promise<BankConnection[]> {
  const ws = await scopedWorkspaces(ctx);
  const filters: SQL[] = [eq(plaidItems.userId, ctx.userId)];
  if (onlyId) filters.push(eq(plaidItems.id, onlyId));
  else if (ws.ids.length === 0) return [];
  else filters.push(inArray(plaidItems.workspaceId, ws.ids));
  const items = await ctx.db.select().from(plaidItems).where(and(...filters)).orderBy(asc(plaidItems.createdAt));
  if (items.length === 0) return [];
  const linked = await ctx.db
    .select({ id: accounts.id, itemId: accounts.plaidItemId })
    .from(accounts)
    .where(inArray(accounts.plaidItemId, items.map((i) => i.id)));
  const all = await ctx.db.select({ id: workspaces.id, kind: workspaces.kind }).from(workspaces).where(eq(workspaces.userId, ctx.userId));
  const kindOf = new Map(all.map((w) => [w.id, w.kind]));
  return items.map((i) => ({
    id: i.id,
    workspaceKind: kindOf.get(i.workspaceId)!,
    institutionName: i.institutionName,
    status: i.status,
    errorCode: i.errorCode,
    lastSyncedAt: i.lastSyncedAt ? i.lastSyncedAt.toISOString() : null,
    accountIds: linked.filter((a) => a.itemId === i.id).map((a) => a.id),
  }));
}

/** Real handlers for every endpoint in the contract, backed by Postgres. */
export const handlers: Handlers = {
  async getMe(_req, { db, userId }) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return notFound("User");
    return { id: user.id, email: user.email, name: user.name, userType: user.userType, createdAt: user.createdAt.toISOString() };
  },

  async listWorkspaces(_req, ctx) {
    const rows = await ctx.db
      .select({ id: workspaces.id, name: workspaces.name, kind: workspaces.kind })
      .from(workspaces)
      .where(eq(workspaces.userId, ctx.userId))
      .orderBy(asc(workspaces.kind));
    return rows;
  },

  listAccounts: (_req, ctx) => scopedAccounts(ctx),

  async listTransactions({ query }, ctx) {
    const ws = await scopedWorkspaces(ctx);
    if (ws.ids.length === 0) return [];
    const filters: SQL[] = [inArray(transactions.workspaceId, ws.ids)];
    if (query.kind) filters.push(eq(transactions.kind, query.kind));
    if (query.accountIds) {
      if (query.accountIds.length === 0) return [];
      filters.push(inArray(transactions.accountId, query.accountIds));
    }
    if (query.from) filters.push(gte(transactions.date, query.from));
    if (query.to) filters.push(lte(transactions.date, query.to));
    const rows = await ctx.db
      .select()
      .from(transactions)
      .where(and(...filters))
      .orderBy(desc(transactions.date), desc(transactions.createdAt), asc(transactions.id));
    return rows.map((t) => toTransaction(t, ws.kindOf.get(t.workspaceId)!));
  },

  async getTransaction({ params }, ctx) {
    const ws = await scopedWorkspaces(ctx);
    if (ws.ids.length === 0) return notFound("Transaction");
    const [row] = await ctx.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, params.id), inArray(transactions.workspaceId, ws.ids)));
    return row ? toTransaction(row, ws.kindOf.get(row.workspaceId)!) : notFound("Transaction");
  },

  async createTransaction({ body }, ctx) {
    // Any of the user's accounts, whatever workspace is selected (matches mock behavior).
    const [account] = await ctx.db
      .select({ id: accounts.id, type: accounts.type, workspaceId: accounts.workspaceId, kind: workspaces.kind })
      .from(accounts)
      .innerJoin(workspaces, eq(accounts.workspaceId, workspaces.id))
      .where(and(eq(accounts.id, body.accountId), eq(workspaces.userId, ctx.userId)));
    if (!account) return notFound("Account");

    const amountCents = body.kind === "income" ? body.amountCents : -body.amountCents;
    const row = await ctx.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(transactions)
        .values({
          id: newId("tx"),
          workspaceId: account.workspaceId,
          accountId: account.id,
          date: body.date,
          amountCents,
          kind: body.kind,
          description: body.description,
          counterparty: body.counterparty ?? null,
          category: body.category,
          source: "manual",
          pending: false,
          notes: body.notes ?? null,
        })
        .returning();
      if (!INVESTMENT_TYPES.has(account.type)) {
        await tx
          .update(accounts)
          .set({ balanceCents: sql`${accounts.balanceCents} + ${amountCents}` })
          .where(eq(accounts.id, account.id));
      }
      return inserted!;
    });
    return toTransaction(row, account.kind);
  },

  async listInvoices(_req, ctx) {
    if (ctx.workspace === "personal") return [];
    const workspaceId = await getWorkspaceId(ctx.db, ctx.userId, "business");
    const rows = await ctx.db
      .select()
      .from(invoices)
      .where(eq(invoices.workspaceId, workspaceId))
      .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));
    return rows.map(toInvoice);
  },

  async createInvoice({ body }, ctx) {
    const workspaceId = await getWorkspaceId(ctx.db, ctx.userId, "business");
    const [existing] = await ctx.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.number, body.number)));
    if (existing) throw new HttpError(409, `Invoice ${body.number} already exists`);
    const [row] = await ctx.db
      .insert(invoices)
      .values({
        id: newId("inv"),
        workspaceId,
        ...body,
        paidDate: body.status === "paid" ? body.issueDate : null,
      })
      .returning();
    return toInvoice(row!);
  },

  async getBalanceHistory({ query }, ctx) {
    const selected = (await scopedAccounts(ctx)).filter(
      (a) => isCashAccount(a) && (!query.accountIds || query.accountIds.includes(a.id)),
    );
    const today = utcDay(ctx.now);
    const dates = Array.from({ length: query.days }, (_, i) => isoDate(utcDay(today, i - query.days + 1)));
    if (selected.length === 0) return dates.map((date) => ({ date, balanceCents: 0 }));

    const current = selected.reduce((s, a) => s + a.balanceCents, 0);
    const daily = await ctx.db
      .select({ date: transactions.date, total: sql<string>`sum(${transactions.amountCents})` })
      .from(transactions)
      .where(and(inArray(transactions.accountId, selected.map((a) => a.id)), gte(transactions.date, dates[0]!)))
      .groupBy(transactions.date);
    const byDate = new Map(daily.map((d) => [d.date, Number(d.total)]));

    // Balance at end of day D = current balance minus everything dated after D.
    const todayIso = isoDate(today);
    let after = 0;
    for (const [date, amount] of byDate) if (date > todayIso) after += amount;
    const points: { date: string; balanceCents: number }[] = [];
    for (let i = dates.length - 1; i >= 0; i--) {
      const date = dates[i]!;
      points.push({ date, balanceCents: current - after });
      after += byDate.get(date) ?? 0;
    }
    return points.reverse();
  },

  async getMonthlyTotals({ query }, ctx) {
    const today = utcDay(ctx.now);
    const months = Array.from({ length: query.months }, (_, i) => isoDate(monthStart(today, i - query.months)).slice(0, 7));
    const totals = new Map(months.map((m) => [m, 0]));
    const ws = await scopedWorkspaces(ctx);
    if (ws.ids.length > 0 && query.accountIds?.length !== 0) {
      const month = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
      const filters: SQL[] = [
        inArray(transactions.workspaceId, ws.ids),
        eq(transactions.kind, query.kind),
        gte(transactions.date, isoDate(monthStart(today, -query.months))),
        lt(transactions.date, isoDate(monthStart(today))),
      ];
      if (query.accountIds) filters.push(inArray(transactions.accountId, query.accountIds));
      const rows = await ctx.db
        .select({ month, total: sql<string>`sum(abs(${transactions.amountCents}))` })
        .from(transactions)
        .where(and(...filters))
        .groupBy(month);
      for (const r of rows) if (totals.has(r.month)) totals.set(r.month, Number(r.total));
    }
    return [...totals].map(([month, amountCents]) => ({ month, amountCents }));
  },

  async listHoldings({ query }, ctx) {
    const ids = (await scopedAccounts(ctx))
      .filter((a) => query.custodial === undefined || (a.custodian !== null) === query.custodial)
      .map((a) => a.id);
    if (ids.length === 0) return [];
    const rows = await ctx.db
      .select()
      .from(holdings)
      .where(inArray(holdings.accountId, ids))
      .orderBy(asc(holdings.accountId), desc(holdings.marketValueCents));
    return rows.map(toHolding);
  },

  async getHolding({ params }, ctx) {
    const ws = await scopedWorkspaces(ctx);
    if (ws.ids.length === 0) return notFound("Holding");
    const [row] = await ctx.db
      .select({ holding: holdings })
      .from(holdings)
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(and(eq(holdings.id, params.id), inArray(accounts.workspaceId, ws.ids)));
    return row ? toHolding(row.holding) : notFound("Holding");
  },

  getOnboarding: (_req, { db, userId }) => readOnboarding(db, userId),

  async saveOnboarding({ body }, { db, userId, now }) {
    if (body.userType !== undefined) {
      await db.update(users).set({ userType: body.userType }).where(eq(users.id, userId));
    }
    const patch: Partial<typeof onboarding.$inferInsert> = {};
    if (body.filingStatus !== undefined) patch.filingStatus = body.filingStatus;
    if (body.state !== undefined) patch.state = body.state;
    if (body.accountsMode !== undefined) patch.accountsMode = body.accountsMode;
    if (body.completedAt !== undefined) patch.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    if (Object.keys(patch).length > 0) {
      await db.insert(onboarding).values({ userId, ...patch }).onConflictDoUpdate({ target: onboarding.userId, set: patch });
    }
    if (body.allocationRules) await writeAllocationRules(db, userId, body.allocationRules);
    // Choosing sample data fills empty workspaces with the demo data set.
    if (body.accountsMode === "sample") await seedSampleData(db, userId, now);
    return readOnboarding(db, userId);
  },

  async getAllocationRules(_req, { db, userId }) {
    return (await readAllocationRules(db, userId)) ?? DEFAULT_ALLOCATION_RULES;
  },

  async saveAllocationRules({ body }, { db, userId }) {
    await writeAllocationRules(db, userId, body);
    return body;
  },

  async getTaxSettings(_req, { db, userId, now }): Promise<TaxSettings> {
    const [row] = await db.select().from(taxSettings).where(eq(taxSettings.userId, userId));
    const [answers] = await db.select().from(onboarding).where(eq(onboarding.userId, userId));
    // Onboarding answers win for filing status and state, since that is where the user sets them.
    return {
      taxYear: row?.taxYear ?? now.getUTCFullYear(),
      filingStatus: answers?.filingStatus ?? row?.filingStatus ?? "single",
      state: answers?.state ?? row?.state ?? "CA",
      estimatedEffectiveRatePercent: row ? fromBasisPoints(row.effectiveRateBasisPoints) : 25,
      priorYearTotalTaxCents: row?.priorYearTotalTaxCents ?? 0,
      priorYearAgiCents: row?.priorYearAgiCents ?? 0,
      safeHarborMethod: row?.safeHarborMethod ?? "prior_year_100",
    };
  },

  async listCreditCards(_req, ctx) {
    const cards = (await scopedAccounts(ctx)).filter((a) => a.type === "credit");
    const profiles = await readCardProfiles(ctx.db, cards.map((c) => c.id));
    return cards.map((c) => toCreditCard(c, profiles.get(c.id)));
  },

  async saveCreditCard({ params, body }, ctx) {
    const owned = await ownedAccount(ctx.db, ctx.userId, params.accountId);
    if (!owned || owned.account.type !== "credit") return notFound("Credit card");
    const { owedCents, ...profile } = body;
    await writeCardProfile(ctx.db, owned.account.id, profile);
    let balanceCents = owned.account.balanceCents;
    // Plaid cards get their balance from the bank. Others can be corrected by hand.
    if (owedCents !== undefined && owned.account.connection !== "plaid") {
      balanceCents = -owedCents;
      await ctx.db.update(accounts).set({ balanceCents }).where(eq(accounts.id, owned.account.id));
    }
    const { account, kind } = owned;
    return toCreditCard(
      { ...account, workspaceKind: kind, balanceCents },
      (await readCardProfiles(ctx.db, [account.id])).get(account.id),
    );
  },

  async importStatement({ body }, ctx) {
    let accountId: string;
    let workspaceId: string;
    if (body.newAccount) {
      workspaceId = await getWorkspaceId(ctx.db, ctx.userId, body.newAccount.workspaceKind);
      accountId = newId("acc");
      await ctx.db.insert(accounts).values({
        id: accountId,
        workspaceId,
        name: body.newAccount.name,
        institution: body.format === "apple_card" ? "Apple" : "Imported",
        type: "credit",
        connection: "csv",
        mask: body.newAccount.mask,
        balanceCents: 0,
      });
      const preset = body.format === "apple_card" ? findCreditCardPreset("apple_card") : undefined;
      await writeCardProfile(ctx.db, accountId, {
        ...DEFAULT_CREDIT_CARD_PROFILE,
        ...(preset ? { ...preset.profile, preset: preset.id } : {}),
      });
    } else {
      const owned = await ownedAccount(ctx.db, ctx.userId, body.accountId!);
      if (!owned || owned.account.type !== "credit") return notFound("Credit card");
      accountId = owned.account.id;
      workspaceId = owned.account.workspaceId;
    }

    const inserted = await ctx.db.transaction(async (tx) => {
      let count = 0;
      let delta = 0;
      for (let i = 0; i < body.rows.length; i += 200) {
        const chunk = body.rows.slice(i, i + 200);
        const rows = await tx
          .insert(transactions)
          .values(chunk.map((r) => ({ id: newId("tx"), workspaceId, accountId, ...r, source: "csv" as const, pending: false, notes: null })))
          .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
          .returning({ amountCents: transactions.amountCents });
        count += rows.length;
        delta += rows.reduce((s, r) => s + r.amountCents, 0);
      }
      if (delta !== 0) {
        await tx.update(accounts).set({ balanceCents: sql`${accounts.balanceCents} + ${delta}` }).where(eq(accounts.id, accountId));
      }
      return count;
    });
    return { accountId, inserted, skipped: body.rows.length - inserted };
  },

  async getPlaidStatus(_req, ctx) {
    return { enabled: ctx.plaid !== null, environment: ctx.plaid?.env ?? null };
  },

  async createPlaidLinkToken({ body }, ctx) {
    const plaid = requirePlaid(ctx);
    let accessToken: string | undefined;
    if (body.connectionId) {
      const item = await ownedItem(ctx, body.connectionId);
      accessToken = decryptToken(item.accessTokenEncrypted, plaid.tokenKey);
    }
    const res = await withPlaidErrors(() =>
      plaid.api.linkTokenCreate({ userId: ctx.userId, accessToken, webhookUrl: plaid.webhookUrl, redirectUri: plaid.redirectUri }),
    );
    return { linkToken: res.link_token, expiration: res.expiration };
  },

  async exchangePlaidPublicToken({ body }, ctx) {
    const plaid = requirePlaid(ctx);
    const exchanged = await withPlaidErrors(() => plaid.api.itemPublicTokenExchange(body.publicToken));
    const workspaceId = await getWorkspaceId(ctx.db, ctx.userId, body.workspaceKind);
    const [item] = await ctx.db
      .insert(plaidItems)
      .values({
        id: newId("conn"),
        userId: ctx.userId,
        workspaceId,
        plaidItemId: exchanged.item_id,
        accessTokenEncrypted: encryptToken(exchanged.access_token, plaid.tokenKey),
        institutionName: body.institutionName?.trim() || "Bank",
      })
      .returning();
    try {
      await syncPlaidItem(ctx.db, plaid, item!, ctx.now);
    } catch (error) {
      // Transactions may not be ready yet. The SYNC_UPDATES_AVAILABLE webhook or a manual sync picks them up.
      if (!(error instanceof PlaidApiError)) throw error;
    }
    return (await listUserConnections(ctx, item!.id))[0]!;
  },

  listConnections: (_req, ctx) => listUserConnections(ctx),

  async syncConnection({ params }, ctx) {
    const plaid = requirePlaid(ctx);
    const item = await ownedItem(ctx, params.id);
    return withPlaidErrors(() => syncPlaidItem(ctx.db, plaid, item, ctx.now));
  },

  async removeConnection({ params }, ctx) {
    const plaid = requirePlaid(ctx);
    const item = await ownedItem(ctx, params.id);
    try {
      await plaid.api.itemRemove(decryptToken(item.accessTokenEncrypted, plaid.tokenKey));
    } catch (error) {
      // Already removed at Plaid, or the token is invalid. Still drop it here.
      if (!(error instanceof PlaidApiError)) throw error;
    }
    await ctx.db.transaction(async (tx) => {
      // Keep the accounts and their history; they just stop syncing.
      await tx.update(accounts).set({ connection: "manual", plaidItemId: null }).where(eq(accounts.plaidItemId, item.id));
      await tx.delete(plaidItems).where(eq(plaidItems.id, item.id));
    });
    return { ok: true as const };
  },
};
