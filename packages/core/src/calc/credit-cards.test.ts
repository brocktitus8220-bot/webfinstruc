import { describe, expect, it } from "vitest";
import { analyzeCreditCards, formatEarnRate, rewardValueCents, valueRateBasisPoints } from "./credit-cards";
import { findCreditCardPreset } from "../cards/presets";
import { rewardCategoryFor } from "../cards/categories";
import type { CreditCard, CreditCardProfile } from "../schemas/credit-card";
import type { Transaction } from "../schemas/transaction";

const profile = (id: string, extra: Partial<CreditCardProfile> = {}): CreditCardProfile => ({
  ...findCreditCardPreset(id)!.profile,
  preset: id,
  creditLimitCents: 1_000_000,
  aprBasisPoints: 2_499,
  statementDay: 20,
  dueDay: 15,
  ...extra,
});

const card = (accountId: string, p: CreditCardProfile, balanceCents = 0, workspaceKind: "business" | "personal" = "personal"): CreditCard => ({
  accountId, workspaceId: `ws_${workspaceKind}`, workspaceKind, name: accountId, institution: "Bank", mask: "0000",
  connection: "sample", balanceCents, profile: p,
});

let seq = 0;
const tx = (accountId: string, category: string, amountCents: number, kind: Transaction["kind"] = "expense"): Transaction => ({
  id: `t${++seq}`, workspaceId: "ws_personal", workspaceKind: "personal", accountId, date: "2026-10-01", amountCents, kind,
  description: category, counterparty: null, category, source: "plaid", pending: false, notes: null,
});

describe("reward math", () => {
  it("values points by their cent value", () => {
    const travel = profile("travel_3x");
    expect(valueRateBasisPoints(travel, "dining")).toBe(375);
    expect(rewardValueCents(travel, "dining", 10_000)).toBe(375);
    expect(formatEarnRate(travel, "dining")).toBe("3x");
    expect(formatEarnRate(profile("flat_2"), "dining")).toBe("2%");
  });

  it("applies yearly caps, scaled to the period", () => {
    const grocery = profile("grocery_6");
    // Cap is $6,000 a year, so $1,500 for a quarter. $2,000 spend: $1,500 at 6% + $500 at 1%.
    expect(rewardValueCents(grocery, "groceries", 200_000, 0.25)).toBe(9_000 + 500);
  });

  it("maps transaction categories to reward categories", () => {
    expect(rewardCategoryFor("Restaurants")).toBe("dining");
    expect(rewardCategoryFor(" groceries ")).toBe("groceries");
    expect(rewardCategoryFor("Rent")).toBe("other");
  });
});

describe("analyzeCreditCards", () => {
  const flat = card("flat", profile("flat_2"), -400_000);
  const everyday = card("everyday", profile("everyday_3"), -50_000);
  const biz = card("biz", profile("business_1_5", { creditLimitCents: null }), -10_000, "business");
  const txs = [
    tx("flat", "Dining", -60_000),
    tx("flat", "Groceries", -90_000),
    tx("everyday", "Gas", -10_000),
    tx("flat", "Card payment", 50_000, "transfer"),
    tx("biz", "Dining", -20_000),
    tx("other_account", "Dining", -99_999),
  ];
  const analysis = analyzeCreditCards([flat, everyday, biz], txs, 3);

  it("counts only purchases on the given cards", () => {
    expect(analysis.totals.spendCents).toBe(180_000);
    const flatSummary = analysis.cards.find((c) => c.accountId === "flat")!;
    expect(flatSummary.spendCents).toBe(150_000);
    expect(flatSummary.rewardsCents).toBe(3_000);
    expect(flatSummary.annualizedRewardsCents).toBe(12_000);
    expect(flatSummary.utilizationBasisPoints).toBe(4_000);
  });

  it("finds the best card per category within the same workspace", () => {
    const dining = analysis.categories.find((c) => c.category === "dining" && c.workspaceKind === "personal")!;
    expect(dining.bestAccountId).toBe("everyday");
    expect(dining.earnedCents).toBe(1_200);
    expect(dining.missedCents).toBe(600);
    const bizDining = analysis.categories.find((c) => c.workspaceKind === "business")!;
    expect(bizDining.bestAccountId).toBe("biz");
    expect(bizDining.missedCents).toBe(0);
  });

  it("recommends switching cards, paying down, and adding limits", () => {
    const kinds = analysis.recommendations.map((r) => r.kind);
    expect(kinds[0]).toBe("utilization");
    expect(analysis.recommendations.find((r) => r.id === "switch:personal:groceries")?.annualValueCents).toBe(3_600);
    expect(kinds).toContain("missing_limit");
    expect(analysis.totals.utilizationBasisPoints).toBeNull();
  });

  it("flags fee cards that do not pay for themselves", () => {
    const travel = card("travel", profile("travel_3x"));
    const a = analyzeCreditCards([travel], [tx("travel", "Rent", -10_000)], 12);
    expect(a.recommendations.map((r) => r.kind)).toContain("annual_fee");
  });
});
