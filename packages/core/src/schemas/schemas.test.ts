import { describe, expect, it } from "vitest";
import { AllocationRules, CreateInvoiceInput, CreateTransactionInput, Transaction } from "./index";

describe("schemas", () => {
  it("requires a known transaction source", () => {
    const base = {
      id: "t1", workspaceId: "w1", workspaceKind: "business", accountId: "a1", date: "2026-01-02",
      amountCents: 1000, kind: "income", description: "Client", counterparty: null, category: "Sales",
      pending: false, notes: null,
    };
    expect(Transaction.safeParse({ ...base, source: "plaid" }).success).toBe(true);
    expect(Transaction.safeParse({ ...base, source: "manual" }).success).toBe(true);
    expect(Transaction.safeParse({ ...base, source: "other" }).success).toBe(true);
    expect(Transaction.safeParse({ ...base, source: "csv" }).success).toBe(true);
    expect(Transaction.safeParse({ ...base, source: "bank" }).success).toBe(false);
    expect(Transaction.safeParse(base).success).toBe(false);
  });

  it("rejects float amounts", () => {
    const r = CreateTransactionInput.safeParse({
      kind: "expense", accountId: "a1", date: "2026-01-02", amountCents: 10.5, description: "x", category: "y",
    });
    expect(r.success).toBe(false);
  });

  it("validates allocation rules sum to 100", () => {
    expect(AllocationRules.safeParse([{ bucket: "tax", percent: 100 }]).success).toBe(true);
    expect(AllocationRules.safeParse([{ bucket: "tax", percent: 99.99 }]).success).toBe(false);
    expect(
      AllocationRules.safeParse([
        { bucket: "tax", percent: 33.33 },
        { bucket: "operating", percent: 33.33 },
        { bucket: "savings", percent: 33.34 },
      ]).success,
    ).toBe(true);
  });

  it("requires invoice due date on or after issue date", () => {
    const r = CreateInvoiceInput.safeParse({
      client: "Acme", number: "INV-1", issueDate: "2026-02-01", dueDate: "2026-01-01", amountCents: 100,
    });
    expect(r.success).toBe(false);
  });
});
