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
    txs.forEach((t) => expect(["plaid", "manual", "other"]).toContain(t.source));
  });
});
