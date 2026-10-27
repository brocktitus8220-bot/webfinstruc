import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { type ApiClient, createApiClient, createFetchTransport } from "@repo/api-client";
import { createMockTransport } from "@repo/api-client/mock";
import type { WorkspaceScope } from "@repo/core";
import { type Database, schema } from "@repo/db";
import { MIGRATIONS_FOLDER } from "@repo/db/migrate";
import { dispatch } from "./router";
import { ensureUser } from "./provision";
import { seedSampleData } from "./seed";

const now = new Date("2026-10-27T15:00:00Z");
let db: Database;

/** A fetch that routes straight into the API, so tests cover the real HTTP transport too. */
const fetchFor =
  (userId: string): typeof fetch =>
  async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const res = await dispatch(
      { method: init?.method ?? "GET", path: url.pathname.replace(/^\/api\/v1/, ""), searchParams: url.searchParams, headers: new Headers(init?.headers), body },
      { db, userId, now },
    );
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { "content-type": "application/json" } });
  };

const clientFor = (userId: string, workspace: WorkspaceScope = "all"): ApiClient =>
  createApiClient({
    transport: createFetchTransport("http://test.local/api/v1", fetchFor(userId)),
    getToken: () => null,
    getWorkspace: () => workspace,
  });

const mockFor = (workspace: WorkspaceScope = "all") =>
  createApiClient({ transport: createMockTransport({ now: () => now }), getToken: () => null, getWorkspace: () => workspace });

beforeAll(async () => {
  const pg = new PGlite();
  const pgDb = drizzle(pg, { schema });
  await migrate(pgDb, { migrationsFolder: MIGRATIONS_FOLDER });
  db = pgDb as unknown as Database;
  await ensureUser(db, { id: "user_a", email: "a@example.com", name: "User A" });
  await ensureUser(db, { id: "user_b", email: "b@example.com", name: "User B" });
  await seedSampleData(db, "user_a", now);
}, 60_000);

describe("api server", () => {
  it("provisions users idempotently with two workspaces", async () => {
    await ensureUser(db, { id: "user_a", email: "changed@example.com", name: "Changed" });
    const me = await clientFor("user_a").getMe();
    expect(me.email).toBe("a@example.com");
    const ws = await clientFor("user_a").listWorkspaces();
    expect(ws.map((w) => w.kind).sort()).toEqual(["business", "personal"]);
  });

  it("matches the mock for seeded sample data", async () => {
    for (const scope of ["all", "business", "personal"] as const) {
      const real = clientFor("user_a", scope);
      const mock = mockFor(scope);

      const byName = (list: { name: string; balanceCents: number }[]) =>
        Object.fromEntries(list.map((a) => [a.name, a.balanceCents]));
      expect(byName(await real.listAccounts())).toEqual(byName(await mock.listAccounts()));

      expect(await real.getBalanceHistory({ query: { days: 90 } })).toEqual(await mock.getBalanceHistory({ query: { days: 90 } }));
      for (const kind of ["income", "expense"] as const) {
        expect(await real.getMonthlyTotals({ query: { kind } })).toEqual(await mock.getMonthlyTotals({ query: { kind } }));
      }
      expect((await real.listTransactions()).length).toBe((await mock.listTransactions()).length);
      expect((await real.listInvoices()).length).toBe((await mock.listInvoices()).length);
    }
  });

  it("keeps users apart", async () => {
    const b = clientFor("user_b");
    expect(await b.listAccounts()).toEqual([]);
    expect(await b.listTransactions()).toEqual([]);
    const [tx] = await clientFor("user_a").listTransactions();
    await expect(b.getTransaction({ params: { id: tx!.id } })).rejects.toMatchObject({ status: 404 });
  });

  it("filters transactions by kind, account, and date", async () => {
    const api = clientFor("user_a", "business");
    const accounts = await api.listAccounts();
    const checking = accounts.find((a) => a.name === "Business Checking")!;
    const list = await api.listTransactions({ query: { kind: "income", accountIds: [checking.id], from: "2026-06-01", to: "2026-06-30" } });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.kind === "income" && t.accountId === checking.id && t.date.startsWith("2026-06"))).toBe(true);
  });

  it("parses custodial=false as false", async () => {
    const api = clientFor("user_a");
    const custodial = await api.listHoldings({ query: { custodial: true } });
    const self = await api.listHoldings({ query: { custodial: false } });
    const all = await api.listHoldings();
    expect(custodial.length).toBeGreaterThan(0);
    expect(self.length).toBeGreaterThan(0);
    expect(custodial.length + self.length).toBe(all.length);
    const h = await api.getHolding({ params: { id: self[0]!.id } });
    expect(h.symbol).toBe(self[0]!.symbol);
  });

  it("creates a transaction and updates the cash balance", async () => {
    const api = clientFor("user_a", "personal");
    const checking = (await api.listAccounts()).find((a) => a.name === "Personal Checking")!;
    const tx = await api.createTransaction({
      body: { kind: "expense", accountId: checking.id, date: "2026-10-27", amountCents: 12_345, description: "Coffee beans", category: "Groceries" },
    });
    expect(tx).toMatchObject({ amountCents: -12_345, source: "manual", workspaceKind: "personal" });
    const after = (await api.listAccounts()).find((a) => a.id === checking.id)!;
    expect(after.balanceCents).toBe(checking.balanceCents - 12_345);
    expect((await api.getTransaction({ params: { id: tx.id } })).description).toBe("Coffee beans");
  });

  it("rejects another user's account", async () => {
    const a = (await clientFor("user_a").listAccounts())[0]!;
    await expect(
      clientFor("user_b").createTransaction({
        body: { kind: "income", accountId: a.id, date: "2026-10-27", amountCents: 100, description: "x", category: "y" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("creates invoices and rejects duplicate numbers", async () => {
    const api = clientFor("user_b", "business");
    const body = { client: "Acme", number: "INV-9", issueDate: "2026-10-01", dueDate: "2026-10-31", amountCents: 50_000 };
    const inv = await api.createInvoice({ body });
    expect(inv.status).toBe("sent");
    await expect(api.createInvoice({ body })).rejects.toMatchObject({ status: 409 });
    expect(await clientFor("user_b", "personal").listInvoices()).toEqual([]);
  });

  it("saves onboarding, allocation rules, and feeds tax settings", async () => {
    const api = clientFor("user_b");
    expect(await api.getOnboarding()).toEqual({ completedAt: null });
    const rules = [
      { bucket: "tax", percent: 33.33 },
      { bucket: "operating", percent: 33.33 },
      { bucket: "savings", percent: 33.34 },
    ] as const;
    await api.saveOnboarding({ body: { userType: "creator", filingStatus: "head_of_household", state: "NY" } });
    const saved = await api.saveOnboarding({ body: { allocationRules: [...rules], completedAt: "2026-10-27T15:00:00.000Z" } });
    expect(saved).toMatchObject({ userType: "creator", filingStatus: "head_of_household", state: "NY", allocationRules: rules, completedAt: "2026-10-27T15:00:00.000Z" });
    expect(await api.getAllocationRules()).toEqual(rules);
    expect((await api.getMe()).userType).toBe("creator");
    expect(await api.getTaxSettings()).toMatchObject({ filingStatus: "head_of_household", state: "NY", taxYear: 2026 });
  });

  it("seeds sample data when onboarding picks it, once", async () => {
    await ensureUser(db, { id: "user_c", email: "c@example.com", name: "User C" });
    const api = clientFor("user_c");
    await api.saveOnboarding({ body: { accountsMode: "sample" } });
    await api.saveOnboarding({ body: { accountsMode: "sample" } });
    expect((await api.listAccounts()).length).toBe((await mockFor().listAccounts()).length);
  });

  it("returns 400 for bad input and 404 for unknown routes", async () => {
    const res = await dispatch(
      { method: "POST", path: "/transactions", searchParams: new URLSearchParams(), headers: new Headers(), body: { amountCents: 1.5 } },
      { db, userId: "user_a", now },
    );
    expect(res.status).toBe(400);
    const missing = await dispatch(
      { method: "GET", path: "/nope", searchParams: new URLSearchParams(), headers: new Headers(), body: undefined },
      { db, userId: "user_a", now },
    );
    expect(missing.status).toBe(404);
    const wrongMethod = await dispatch(
      { method: "DELETE", path: "/accounts", searchParams: new URLSearchParams(), headers: new Headers(), body: undefined },
      { db, userId: "user_a", now },
    );
    expect(wrongMethod.status).toBe(405);
  });
});
