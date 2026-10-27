import type { Account, Holding, Transaction, TransactionSource, User, Workspace, WorkspaceKind } from "@repo/core";
import { addDays, daysInMonth, monthStart, startOfUtcDay, toIsoDate } from "./dates";

/** Small seeded PRNG so sample data is stable between reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MOCK_USER: User = {
  id: "user_demo",
  email: "demo@example.com",
  name: "Alex Rivera",
  userType: null,
  createdAt: "2025-09-01T12:00:00.000Z",
};

export const MOCK_WORKSPACES: Workspace[] = [
  { id: "ws_business", name: "Rivera Studio LLC", kind: "business" },
  { id: "ws_personal", name: "Personal", kind: "personal" },
];

const wsId = (kind: WorkspaceKind) => (kind === "business" ? "ws_business" : "ws_personal");

export const MOCK_ACCOUNTS: Account[] = [
  {
    id: "acc_biz_checking", workspaceId: "ws_business", workspaceKind: "business", name: "Business Checking",
    institution: "Harbor Point Bank", type: "checking", mask: "4821", balanceCents: 4_862_415, currency: "USD", custodian: null,
  },
  {
    id: "acc_tax_reserve", workspaceId: "ws_business", workspaceKind: "business", name: "Tax Reserve",
    institution: "Harbor Point Bank", type: "savings", mask: "9034", balanceCents: 2_140_000, currency: "USD", custodian: null,
  },
  {
    id: "acc_personal_checking", workspaceId: "ws_personal", workspaceKind: "personal", name: "Personal Checking",
    institution: "Northline Credit Union", type: "checking", mask: "1177", balanceCents: 1_186_240, currency: "USD", custodian: null,
  },
  {
    id: "acc_brokerage", workspaceId: "ws_personal", workspaceKind: "personal", name: "Individual Brokerage",
    institution: "Self-directed broker", type: "brokerage", mask: "5502", balanceCents: 0, currency: "USD", custodian: null,
  },
  {
    id: "acc_sep_ira", workspaceId: "ws_personal", workspaceKind: "personal", name: "SEP IRA",
    institution: "Advisor managed", type: "retirement", mask: "7310", balanceCents: 0, currency: "USD", custodian: "Meridian Trust Co.",
  },
  {
    id: "acc_custodial_taxable", workspaceId: "ws_business", workspaceKind: "business", name: "Business Reserve Portfolio",
    institution: "Advisor managed", type: "brokerage", mask: "2268", balanceCents: 0, currency: "USD", custodian: "Meridian Trust Co.",
  },
];

const holding = (
  id: string, accountId: string, symbol: string, name: string, assetClass: Holding["assetClass"],
  shares: number, priceCents: number, costPerShareCents: number,
): Holding => {
  const quantityMilli = Math.round(shares * 1000);
  return {
    id, accountId, symbol, name, assetClass, quantityMilli, priceCents,
    marketValueCents: Math.round((quantityMilli * priceCents) / 1000),
    costBasisCents: Math.round((quantityMilli * costPerShareCents) / 1000),
  };
};

export const MOCK_HOLDINGS: Holding[] = [
  holding("h_vti", "acc_brokerage", "VTI", "Total US Stock Market ETF", "fund", 84.25, 29_412, 23_850),
  holding("h_vxus", "acc_brokerage", "VXUS", "Total International Stock ETF", "fund", 120, 6_588, 5_910),
  holding("h_bnd", "acc_brokerage", "BND", "Total Bond Market ETF", "fixed_income", 60, 7_342, 7_610),
  holding("h_cash_b", "acc_brokerage", "CASH", "Sweep cash", "cash", 1_820.55, 100, 100),
  holding("h_ira_tdf", "acc_sep_ira", "TDF2055", "Target Date 2055 Fund", "fund", 1_412.8, 5_216, 4_480),
  holding("h_ira_sc", "acc_sep_ira", "VB", "US Small Cap ETF", "fund", 38, 24_105, 21_040),
  holding("h_ira_cash", "acc_sep_ira", "CASH", "Money market", "cash", 2_500, 100, 100),
  holding("h_ct_tbill", "acc_custodial_taxable", "TBILL", "3-Month Treasury Bill Ladder", "fixed_income", 250, 9_874, 9_801),
  holding("h_ct_muni", "acc_custodial_taxable", "MUB", "National Municipal Bond ETF", "fixed_income", 110, 10_688, 10_920),
  holding("h_ct_cash", "acc_custodial_taxable", "CASH", "Money market", "cash", 6_200, 100, 100),
];

/** Business gross income per month, oldest first. One slow month on purpose. */
const BUSINESS_INCOME_PLAN = [920_000, 1_140_000, 610_000, 1_480_000, 980_000, 120_000, 1_310_000, 870_000, 1_650_000, 1_020_000, 760_000, 1_240_000];
const CLIENTS = ["Northwind Studio", "Brightline Media", "Atlas & Co.", "Juniper Labs", "Kestrel Partners", "Fieldnote Podcast"];
const BUSINESS_EXPENSES: [string, string, number, number][] = [
  // description, category, min cents, max cents
  ["Coworking membership", "Rent", 45_000, 45_000],
  ["Design software", "Software", 5_499, 5_499],
  ["Cloud hosting", "Software", 3_100, 9_800],
  ["Contract editor", "Contractors", 80_000, 240_000],
  ["Client lunch", "Meals", 4_200, 16_500],
  ["Ad campaign", "Marketing", 15_000, 60_000],
  ["Liability insurance", "Insurance", 12_400, 12_400],
];
const PERSONAL_EXPENSES: [string, string, number, number][] = [
  ["Rent", "Housing", 220_000, 220_000],
  ["Grocery market", "Groceries", 32_000, 61_000],
  ["Electric and internet", "Utilities", 14_000, 22_000],
  ["Health plan premium", "Health", 48_000, 48_000],
  ["Dinner out", "Dining", 6_000, 21_000],
  ["Gym", "Health", 6_500, 6_500],
];

export function buildMockTransactions(now: Date): Transaction[] {
  const rand = mulberry32(20_26);
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const today = startOfUtcDay(now);
  const out: Transaction[] = [];
  let seq = 0;

  const push = (
    kind: Transaction["kind"], ws: WorkspaceKind, accountId: string, date: Date, amountCents: number,
    description: string, category: string, counterparty: string | null, source: TransactionSource = "plaid",
  ) => {
    if (date > today) return;
    seq += 1;
    out.push({
      id: `tx_${String(seq).padStart(5, "0")}`,
      workspaceId: wsId(ws), workspaceKind: ws, accountId, date: toIsoDate(date), amountCents, kind,
      description, counterparty, category, source,
      pending: (today.getTime() - date.getTime()) / 86_400_000 < 2,
      notes: null,
    });
  };

  // 12 full months of history plus the current partial month.
  for (let offset = -12; offset <= 0; offset++) {
    const start = monthStart(today, offset);
    const days = daysInMonth(start);
    const day = (n: number) => addDays(start, Math.min(n, days) - 1);
    const planIndex = offset + 12;
    const gross = planIndex < BUSINESS_INCOME_PLAN.length ? BUSINESS_INCOME_PLAN[planIndex]! : between(700_000, 1_300_000);

    // Business income split into 1 to 3 client payments.
    const parts = gross < 200_000 ? 1 : between(2, 3);
    let remaining = gross;
    for (let p = 0; p < parts; p++) {
      const amount = p === parts - 1 ? remaining : Math.round((remaining * between(30, 60)) / 100);
      remaining -= amount;
      const client = CLIENTS[between(0, CLIENTS.length - 1)]!;
      const source: TransactionSource = rand() < 0.15 ? "manual" : "plaid";
      push("income", "business", "acc_biz_checking", day(between(3, 27)), amount, `Payment from ${client}`, client.includes("Podcast") ? "Sponsorship" : "Client services", client, source);
    }

    for (const [desc, cat, min, max] of BUSINESS_EXPENSES) {
      if (cat === "Marketing" && rand() < 0.5) continue;
      push("expense", "business", "acc_biz_checking", day(between(1, 28)), -between(min, max), desc, cat, null, rand() < 0.1 ? "other" : "plaid");
    }

    // Owner pay and tax set-aside, as transfers.
    push("transfer", "business", "acc_biz_checking", day(1), -400_000, "Owner pay", "Transfer", "Personal Checking");
    push("transfer", "personal", "acc_personal_checking", day(1), 400_000, "Owner pay", "Transfer", "Business Checking");
    push("transfer", "business", "acc_biz_checking", day(15), -250_000, "Tax set-aside", "Transfer", "Tax Reserve");
    push("transfer", "business", "acc_tax_reserve", day(15), 250_000, "Tax set-aside", "Transfer", "Business Checking");

    // Personal: occasional creator payouts plus regular expenses.
    if (rand() < 0.7) {
      push("income", "personal", "acc_personal_checking", day(between(8, 20)), between(40_000, 260_000), "Platform payout", "Platform payout", "Creator platform");
    }
    for (const [desc, cat, min, max] of PERSONAL_EXPENSES) {
      push("expense", "personal", "acc_personal_checking", day(between(1, 28)), -between(min, max), desc, cat, null, rand() < 0.1 ? "manual" : "plaid");
    }
  }

  return out.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
}
