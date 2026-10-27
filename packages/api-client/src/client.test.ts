import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import { createMockTransport } from "./mock";
import type { ApiRequest } from "./types";

const fixedNow = () => new Date("2026-10-27T15:00:00Z");

const makeClient = (workspace: "business" | "personal" | "all" = "all") => {
  const transport = vi.fn(createMockTransport({ now: fixedNow }));
  const client = createApiClient({ transport, getToken: async () => "tok_123", getWorkspace: () => workspace });
  return { client, transport };
};

describe("api client", () => {
  it("sends the token and workspace with every call", async () => {
    const { client, transport } = makeClient("business");
    await client.listAccounts();
    const req = transport.mock.calls[0]![0] as ApiRequest;
    expect(req.headers.authorization).toBe("Bearer tok_123");
    expect(req.headers["x-workspace"]).toBe("business");
    expect(req.workspace).toBe("business");
  });

  it("filters by workspace", async () => {
    const biz = await makeClient("business").client.listAccounts();
    const all = await makeClient("all").client.listAccounts();
    expect(biz.every((a) => a.workspaceKind === "business")).toBe(true);
    expect(all.length).toBeGreaterThan(biz.length);
  });

  it("fills path params", async () => {
    const { client, transport } = makeClient();
    const [first] = await client.listTransactions();
    const tx = await client.getTransaction({ params: { id: first!.id } });
    expect(tx.id).toBe(first!.id);
    expect((transport.mock.calls[1]![0] as ApiRequest).path).toBe(`/transactions/${first!.id}`);
  });

  it("validates input before sending", async () => {
    const { client, transport } = makeClient();
    await expect(
      client.createTransaction({
        body: { kind: "income", accountId: "acc_biz_checking", date: "2026-10-01", amountCents: 1.5, description: "x", category: "y" },
      }),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });

  it("validates responses", async () => {
    const client = createApiClient({
      transport: async () => [{ nope: true }],
      getToken: () => null,
      getWorkspace: () => "all",
    });
    await expect(client.listAccounts()).rejects.toThrow();
  });

  it("returns 30 daily balance points ending today", async () => {
    const { client } = makeClient();
    const points = await client.getBalanceHistory({ query: { days: 30 } });
    expect(points).toHaveLength(30);
    expect(points.at(-1)!.date).toBe("2026-10-27");
    points.forEach((p) => expect(Number.isInteger(p.balanceCents)).toBe(true));
  });

  it("every transaction has a valid source", async () => {
    const { client } = makeClient();
    const txs = await client.listTransactions();
    expect(txs.length).toBeGreaterThan(50);
    txs.forEach((t) => expect(["plaid", "manual", "csv", "other"]).toContain(t.source));
  });

  it("lists sample credit cards with negative balances and profiles", async () => {
    const cards = await makeClient("personal").client.listCreditCards();
    expect(cards.map((c) => c.name).sort()).toEqual(["Apple Card", "Travel Rewards Card"]);
    expect(cards.every((c) => c.balanceCents < 0 && c.profile.creditLimitCents)).toBe(true);
  });

  it("imports statement rows once and creates the card", async () => {
    const { client } = makeClient();
    const rows = [
      { date: "2026-10-02", amountCents: -650, kind: "expense" as const, description: "Coffee", counterparty: "Cafe", category: "Dining", externalId: "apple:a:1" },
      { date: "2026-10-10", amountCents: 50_000, kind: "transfer" as const, description: "Payment", counterparty: null, category: "Card payment", externalId: "apple:b:1" },
    ];
    const first = await client.importStatement({ body: { format: "apple_card", newAccount: { workspaceKind: "personal", name: "My Apple Card", mask: "1234" }, rows } });
    expect(first).toMatchObject({ inserted: 2, skipped: 0 });
    const again = await client.importStatement({ body: { format: "apple_card", accountId: first.accountId, rows } });
    expect(again).toMatchObject({ inserted: 0, skipped: 2 });
    const card = (await client.listCreditCards()).find((c) => c.accountId === first.accountId)!;
    expect(card.connection).toBe("csv");
    expect(card.balanceCents).toBe(49_350);
    expect(card.profile.preset).toBe("apple_card");
  });

  it("saves a card profile and the amount owed", async () => {
    const { client } = makeClient();
    const [card] = await client.listCreditCards();
    const saved = await client.saveCreditCard({ params: { accountId: card!.accountId }, body: { ...card!.profile, annualFeeCents: 0, owedCents: 12_345 } });
    expect(saved.balanceCents).toBe(-12_345);
    expect(saved.profile.annualFeeCents).toBe(0);
  });

  it("reports Plaid as unavailable in sample mode", async () => {
    const { client } = makeClient();
    expect(await client.getPlaidStatus()).toEqual({ enabled: false, environment: null });
    await expect(client.createPlaidLinkToken({ body: { workspaceKind: "personal" } })).rejects.toThrow(/Plaid/);
  });
});
