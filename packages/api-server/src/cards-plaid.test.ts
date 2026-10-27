import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type ApiClient, createApiClient, createFetchTransport } from "@repo/api-client";
import { createMockTransport } from "@repo/api-client/mock";
import { parseAppleCardCsv, type WorkspaceScope } from "@repo/core";
import { type Database, schema } from "@repo/db";
import { MIGRATIONS_FOLDER } from "@repo/db/migrate";
import { dispatch } from "./router";
import { ensureUser } from "./provision";
import { seedSampleData } from "./seed";
import {
  clearWebhookKeyCache, decryptToken, encryptToken, handlePlaidWebhook, PlaidApiError, type PlaidAccount, type PlaidApi,
  type PlaidService, type PlaidTransaction, verifyPlaidWebhook,
} from "./plaid";

const now = new Date("2026-10-27T15:00:00Z");
let db: Database;

/** In-memory stand-in for Plaid, enough to drive Link, sync, and removal. */
class FakePlaid implements PlaidApi {
  accounts: PlaidAccount[] = [
    { account_id: "pa_chk", name: "Plaid Checking", mask: "0000", type: "depository", subtype: "checking", balances: { available: 100, current: 110.5, limit: null, iso_currency_code: "USD" } },
    { account_id: "pa_cc", name: "Plaid Credit Card", mask: "3333", type: "credit", subtype: "credit card", balances: { available: null, current: 410.25, limit: 2000, iso_currency_code: "USD" } },
    { account_id: "pa_inv", name: "Brokerage", mask: "9999", type: "investment", subtype: "brokerage", balances: { available: null, current: 5000, limit: null, iso_currency_code: "USD" } },
  ];
  /** Pages returned by transactionsSync, keyed by the cursor they answer. */
  pages = new Map<string | null, { added: PlaidTransaction[]; modified: PlaidTransaction[]; removed: { transaction_id: string }[]; next_cursor: string; has_more: boolean }>();
  removedItems: string[] = [];
  failNextSyncWith: PlaidApiError | null = null;
  linkRequests: Parameters<PlaidApi["linkTokenCreate"]>[0][] = [];
  jwk: { kty: string; crv: string; x: string; y: string } | null = null;

  linkTokenCreate: PlaidApi["linkTokenCreate"] = async (req) => {
    this.linkRequests.push(req);
    return { link_token: "link-sandbox-123", expiration: "2026-10-27T19:00:00Z" };
  };
  itemPublicTokenExchange: PlaidApi["itemPublicTokenExchange"] = async (publicToken) => {
    if (publicToken !== "public-sandbox-ok") throw new PlaidApiError(400, "INVALID_INPUT", "INVALID_PUBLIC_TOKEN", "bad token");
    return { access_token: "access-sandbox-secret", item_id: "item_1" };
  };
  accountsGet: PlaidApi["accountsGet"] = async () => ({ accounts: this.accounts, item: { item_id: "item_1" } });
  transactionsSync: PlaidApi["transactionsSync"] = async (_token, cursor) => {
    if (this.failNextSyncWith) {
      const e = this.failNextSyncWith;
      this.failNextSyncWith = null;
      throw e;
    }
    return this.pages.get(cursor) ?? { added: [], modified: [], removed: [], next_cursor: cursor ?? "c0", has_more: false };
  };
  itemRemove: PlaidApi["itemRemove"] = async (token) => {
    this.removedItems.push(token);
  };
  webhookVerificationKeyGet: PlaidApi["webhookVerificationKeyGet"] = async (kid) => ({
    key: { ...this.jwk!, alg: "ES256", kid, use: "sig", created_at: 0, expired_at: null },
  });
}

const ptx = (id: string, account: string, amount: number, primary: string, detailed: string, extra: Partial<PlaidTransaction> = {}): PlaidTransaction => ({
  transaction_id: id, account_id: account, amount, iso_currency_code: "USD", date: "2026-10-20", name: `${id} name`,
  merchant_name: `${id} merchant`, pending: false, personal_finance_category: { primary, detailed }, ...extra,
});

let fake: FakePlaid;
let plaid: PlaidService;
const tokenKey = Buffer.alloc(32, 7);

const fetchFor = (userId: string, withPlaid: boolean): typeof fetch => async (input, init) => {
  const url = new URL(String(input));
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  const res = await dispatch(
    { method: init?.method ?? "GET", path: url.pathname.replace(/^\/api\/v1/, ""), searchParams: url.searchParams, headers: new Headers(init?.headers), body },
    { db, userId, now, plaid: withPlaid ? plaid : null },
  );
  return new Response(JSON.stringify(res.body), { status: res.status, headers: { "content-type": "application/json" } });
};

const clientFor = (userId: string, workspace: WorkspaceScope = "all", withPlaid = true): ApiClient =>
  createApiClient({ transport: createFetchTransport("http://test.local/api/v1", fetchFor(userId, withPlaid)), getToken: () => null, getWorkspace: () => workspace });

beforeAll(async () => {
  const pg = new PGlite();
  const pgDb = drizzle(pg, { schema });
  await migrate(pgDb, { migrationsFolder: MIGRATIONS_FOLDER });
  db = pgDb as unknown as Database;
  for (const id of ["user_a", "user_p", "user_x"]) await ensureUser(db, { id, email: `${id}@example.com`, name: id });
  await seedSampleData(db, "user_a", now);
}, 60_000);

beforeEach(() => {
  fake = new FakePlaid();
  plaid = { api: fake, env: "sandbox", tokenKey, webhookUrl: "https://example.test/api/plaid/webhook" };
});

describe("credit cards", () => {
  it("match the mock for seeded sample data", async () => {
    for (const scope of ["all", "business", "personal"] as const) {
      const real = await clientFor("user_a", scope).listCreditCards();
      const mock = await createApiClient({ transport: createMockTransport({ now: () => now }), getToken: () => null, getWorkspace: () => scope }).listCreditCards();
      const shape = (list: typeof real) => Object.fromEntries(list.map((c) => [c.name, { balance: c.balanceCents, profile: c.profile, connection: c.connection }]));
      expect(shape(real)).toEqual(shape(mock));
    }
  });

  it("save a profile and correct the balance of non-Plaid cards", async () => {
    const api = clientFor("user_a", "personal");
    const apple = (await api.listCreditCards()).find((c) => c.name === "Apple Card")!;
    const saved = await api.saveCreditCard({
      params: { accountId: apple.accountId },
      body: { ...apple.profile, annualFeeCents: 0, rates: [{ category: "transit", rateBasisPoints: 300, annualCapCents: null }], owedCents: 50_000 },
    });
    expect(saved.balanceCents).toBe(-50_000);
    expect(saved.profile.rates).toEqual([{ category: "transit", rateBasisPoints: 300, annualCapCents: null }]);
    expect((await api.listCreditCards()).find((c) => c.accountId === apple.accountId)).toEqual(saved);
  });

  it("reject duplicate categories and other users' cards", async () => {
    const api = clientFor("user_a", "personal");
    const [card] = await api.listCreditCards();
    const rate = { category: "dining" as const, rateBasisPoints: 300, annualCapCents: null };
    await expect(api.saveCreditCard({ params: { accountId: card!.accountId }, body: { ...card!.profile, rates: [rate, rate] } })).rejects.toThrow();
    await expect(clientFor("user_x").saveCreditCard({ params: { accountId: card!.accountId }, body: card!.profile })).rejects.toMatchObject({ status: 404 });
  });
});

describe("statement import", () => {
  const csv = [
    "Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By",
    "10/02/2026,10/03/2026,CAFE,Cafe,Restaurants,Purchase,6.50,Me",
    "10/02/2026,10/03/2026,CAFE,Cafe,Restaurants,Purchase,6.50,Me",
    "10/10/2026,10/10/2026,PAYMENT,Payment,Payment,Payment,-100.00,Me",
  ].join("\n");

  it("creates an Apple Card account, skips re-imports, and tracks the balance", async () => {
    const api = clientFor("user_x", "personal");
    const { rows } = parseAppleCardCsv(csv);
    const first = await api.importStatement({ body: { format: "apple_card", newAccount: { workspaceKind: "personal", name: "Apple Card", mask: "4242" }, rows } });
    expect(first).toMatchObject({ inserted: 3, skipped: 0 });
    const again = await api.importStatement({ body: { format: "apple_card", accountId: first.accountId, rows } });
    expect(again).toMatchObject({ inserted: 0, skipped: 3 });

    const [card] = await api.listCreditCards();
    expect(card).toMatchObject({ accountId: first.accountId, connection: "csv", balanceCents: 10_000 - 1_300 });
    expect(card!.profile.preset).toBe("apple_card");
    const txs = await api.listTransactions({ query: { accountIds: [first.accountId] } });
    expect(txs.map((t) => t.source)).toEqual(["csv", "csv", "csv"]);
  });

  it("will not import into someone else's card", async () => {
    const [card] = await clientFor("user_a", "personal").listCreditCards();
    const { rows } = parseAppleCardCsv(csv);
    await expect(clientFor("user_x").importStatement({ body: { format: "apple_card", accountId: card!.accountId, rows } })).rejects.toMatchObject({ status: 404 });
  });
});

describe("plaid", () => {
  it("is reported off without keys, and its endpoints answer 503", async () => {
    const api = clientFor("user_p", "all", false);
    expect(await api.getPlaidStatus()).toEqual({ enabled: false, environment: null });
    await expect(api.createPlaidLinkToken({ body: { workspaceKind: "personal" } })).rejects.toMatchObject({ status: 503 });
    expect(await api.listConnections()).toEqual([]);
  });

  it("encrypts access tokens at rest", () => {
    const stored = encryptToken("access-sandbox-secret", tokenKey);
    expect(stored).not.toContain("access-sandbox-secret");
    expect(decryptToken(stored, tokenKey)).toBe("access-sandbox-secret");
    expect(() => decryptToken(stored, Buffer.alloc(32, 8))).toThrow();
  });

  it("links, syncs, applies webhooks, repairs, and disconnects", async () => {
    const api = clientFor("user_p", "personal");
    expect(await api.getPlaidStatus()).toEqual({ enabled: true, environment: "sandbox" });
    const link = await api.createPlaidLinkToken({ body: { workspaceKind: "personal" } });
    expect(link.linkToken).toBe("link-sandbox-123");
    expect(fake.linkRequests[0]).toMatchObject({ userId: "user_p", webhookUrl: "https://example.test/api/plaid/webhook" });

    fake.pages.set(null, {
      added: [
        ptx("t_coffee", "pa_cc", 4.75, "FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE"),
        ptx("t_groc", "pa_cc", 82.1, "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES", { pending: true }),
      ],
      modified: [], removed: [], next_cursor: "c1", has_more: true,
    });
    fake.pages.set("c1", {
      added: [
        ptx("t_pay", "pa_chk", -1500, "INCOME", "INCOME_OTHER_INCOME"),
        ptx("t_ccpay", "pa_cc", -200, "LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"),
        ptx("t_refund", "pa_cc", -10, "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OTHER"),
        ptx("t_ignored", "pa_inv", 1, "OTHER", "OTHER"),
      ],
      modified: [], removed: [], next_cursor: "c2", has_more: false,
    });

    await expect(api.exchangePlaidPublicToken({ body: { publicToken: "nope", workspaceKind: "personal" } })).rejects.toMatchObject({ status: 502 });
    const conn = await api.exchangePlaidPublicToken({ body: { publicToken: "public-sandbox-ok", workspaceKind: "personal", institutionName: "First Platypus Bank" } });
    expect(conn).toMatchObject({ institutionName: "First Platypus Bank", status: "active", workspaceKind: "personal" });
    expect(conn.accountIds).toHaveLength(2); // investment account skipped

    const [item] = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.id, conn.id));
    expect(item!.accessTokenEncrypted).not.toContain("access-sandbox-secret");
    expect(item!.cursor).toBe("c2");

    const accounts = await api.listAccounts();
    const chk = accounts.find((a) => a.name === "Plaid Checking")!;
    const cc = accounts.find((a) => a.name === "Plaid Credit Card")!;
    expect(chk).toMatchObject({ type: "checking", connection: "plaid", balanceCents: 11_050, institution: "First Platypus Bank" });
    expect(cc).toMatchObject({ type: "credit", balanceCents: -41_025, mask: "3333" });
    const [card] = await api.listCreditCards();
    expect(card!.profile.creditLimitCents).toBe(200_000);

    const byDesc = Object.fromEntries((await api.listTransactions()).map((t) => [t.description, t]));
    expect(byDesc["t_coffee name"]).toMatchObject({ amountCents: -475, kind: "expense", category: "Dining", source: "plaid" });
    expect(byDesc["t_groc name"]).toMatchObject({ amountCents: -8_210, category: "Groceries", pending: true });
    expect(byDesc["t_pay name"]).toMatchObject({ amountCents: 150_000, kind: "income" });
    expect(byDesc["t_ccpay name"]).toMatchObject({ amountCents: 20_000, kind: "transfer", category: "Card payment" });
    expect(byDesc["t_refund name"]).toMatchObject({ amountCents: 1_000, kind: "transfer", category: "Refund" });

    // Webhook: the pending grocery posts with a new amount, the coffee is removed.
    fake.pages.set("c2", {
      added: [], modified: [ptx("t_groc", "pa_cc", 85.0, "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES")],
      removed: [{ transaction_id: "t_coffee" }], next_cursor: "c3", has_more: false,
    });
    expect(await handlePlaidWebhook(db, plaid, { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: "item_1" }, now)).toBe("synced");
    const after = await api.listTransactions();
    expect(after.find((t) => t.description === "t_coffee name")).toBeUndefined();
    expect(after.find((t) => t.description === "t_groc name")).toMatchObject({ amountCents: -8_500, pending: false });
    expect(after.length).toBe(4);

    // Login expires, then gets repaired through update mode.
    await handlePlaidWebhook(db, plaid, { webhook_type: "ITEM", webhook_code: "ERROR", item_id: "item_1", error: { error_code: "ITEM_LOGIN_REQUIRED" } });
    expect((await api.listConnections())[0]).toMatchObject({ status: "login_required", errorCode: "ITEM_LOGIN_REQUIRED" });
    await api.createPlaidLinkToken({ body: { workspaceKind: "personal", connectionId: conn.id } });
    expect(fake.linkRequests.at(-1)!.accessToken).toBe("access-sandbox-secret");
    await handlePlaidWebhook(db, plaid, { webhook_type: "ITEM", webhook_code: "LOGIN_REPAIRED", item_id: "item_1" });
    expect((await api.listConnections())[0]!.status).toBe("active");
    expect(await handlePlaidWebhook(db, plaid, { webhook_type: "ITEM", webhook_code: "ERROR", item_id: "item_unknown" })).toBe("ignored");

    // A sync that hits ITEM_LOGIN_REQUIRED marks the connection too.
    fake.failNextSyncWith = new PlaidApiError(400, "ITEM_ERROR", "ITEM_LOGIN_REQUIRED", "login required");
    await expect(api.syncConnection({ params: { id: conn.id } })).rejects.toMatchObject({ status: 502 });
    expect((await api.listConnections())[0]!.status).toBe("login_required");

    // Other users cannot see or touch it.
    expect(await clientFor("user_x").listConnections()).toEqual([]);
    await expect(clientFor("user_x").syncConnection({ params: { id: conn.id } })).rejects.toMatchObject({ status: 404 });
    expect(await clientFor("user_p", "business").listConnections()).toEqual([]);

    // Disconnect keeps accounts and history as manual accounts.
    await api.removeConnection({ params: { id: conn.id } });
    expect(fake.removedItems).toEqual(["access-sandbox-secret"]);
    expect(await api.listConnections()).toEqual([]);
    const kept = await api.listAccounts();
    expect(kept.filter((a) => a.connection === "manual").map((a) => a.name).sort()).toEqual(["Plaid Checking", "Plaid Credit Card"]);
    expect((await api.listTransactions()).length).toBe(4);
  });
});

describe("plaid webhook verification", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { kty: string; crv: string; x: string; y: string };
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const makeJwt = (body: string, iat: number, header: Record<string, unknown> = { alg: "ES256", kid: "k1", typ: "JWT" }) => {
    const signing = `${b64(header)}.${b64({ iat, request_body_sha256: createHash("sha256").update(body).digest("hex") })}`;
    const sig = sign("sha256", Buffer.from(signing), { key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${signing}.${sig.toString("base64url")}`;
  };
  const body = JSON.stringify({ webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: "item_1" });

  beforeEach(() => {
    clearWebhookKeyCache();
    fake.jwk = jwk;
  });

  it("accepts a fresh, correctly signed body", async () => {
    expect(await verifyPlaidWebhook(plaid, body, makeJwt(body, now.getTime() / 1000), now)).toBe(true);
  });

  it("rejects tampered bodies, stale tokens, wrong algorithms, and missing headers", async () => {
    const t = now.getTime() / 1000;
    expect(await verifyPlaidWebhook(plaid, body.replace("item_1", "item_2"), makeJwt(body, t), now)).toBe(false);
    expect(await verifyPlaidWebhook(plaid, body, makeJwt(body, t - 600), now)).toBe(false);
    expect(await verifyPlaidWebhook(plaid, body, makeJwt(body, t, { alg: "HS256", kid: "k1" }), now)).toBe(false);
    expect(await verifyPlaidWebhook(plaid, body, null, now)).toBe(false);
    expect(await verifyPlaidWebhook(plaid, body, "not.a.jwt", now)).toBe(false);
  });

  it("rejects a token signed by another key", async () => {
    fake.jwk = generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ format: "jwk" }) as typeof jwk;
    expect(await verifyPlaidWebhook(plaid, body, makeJwt(body, now.getTime() / 1000), now)).toBe(false);
  });
});
