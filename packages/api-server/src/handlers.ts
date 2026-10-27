import { and, asc, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import {
  type Account,
  AccountType,
  ALLOCATION_BUCKETS,
  type AllocationRules,
  DEFAULT_ALLOCATION_RULES,
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
import { getWorkspaceId } from "./provision";
import { seedSampleData } from "./seed";

export interface HandlerContext {
  db: Database;
  userId: string;
  workspace: WorkspaceScope;
  now: Date;
}

export type Handlers = {
  [N in EndpointName]: (req: ParsedRequest<N>, ctx: HandlerContext) => Promise<EndpointResponse<N>>;
};

const { accounts, allocationRules, holdings, invoices, onboarding, taxSettings, transactions, users, workspaces } = schema;

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
};
