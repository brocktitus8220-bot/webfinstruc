import type { Account, CreditCardProfile, Holding, Invoice, Transaction, TransactionSource, User, Workspace, WorkspaceKind } from "@repo/core";
import { findCreditCardPreset } from "@repo/core";
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
    institution: "Harbor Point Bank", type: "checking", connection: "sample", mask: "4821", balanceCents: 4_862_415, currency: "USD", custodian: null,
  },
  {
    id: "acc_tax_reserve", workspaceId: "ws_business", workspaceKind: "business", name: "Tax Reserve",
    institution: "Harbor Point Bank", type: "savings", connection: "sample", mask: "9034", balanceCents: 2_140_000, currency: "USD", custodian: null,
  },
  {
    id: "acc_personal_checking", workspaceId: "ws_personal", workspaceKind: "personal", name: "Personal Checking",
    institution: "Northline Credit Union", type: "checking", connection: "sample", mask: "1177", balanceCents: 1_186_240, currency: "USD", custodian: null,
  },
  {
    id: "acc_brokerage", workspaceId: "ws_personal", workspaceKind: "personal", name: "Individual Brokerage",
    institution: "Self-directed broker", type: "brokerage", connection: "sample", mask: "5502", balanceCents: 0, currency: "USD", custodian: null,
  },
  {
    id: "acc_sep_ira", workspaceId: "ws_personal", workspaceKind: "personal", name: "SEP IRA",
    institution: "Advisor managed", type: "retirement", connection: "sample", mask: "7310", balanceCents: 0, currency: "USD", custodian: "Meridian Trust Co.",
  },
  {
    id: "acc_custodial_taxable", workspaceId: "ws_business", workspaceKind: "business", name: "Business Reserve Portfolio",
    institution: "Advisor managed", type: "brokerage", connection: "sample", mask: "2268", balanceCents: 0, currency: "USD", custodian: "Meridian Trust Co.",
  },
  {
    id: "acc_biz_card", workspaceId: "ws_business", workspaceKind: "business", name: "Business Card",
    institution: "Harbor Point Bank", type: "credit", connection: "sample", mask: "6604", balanceCents: -238_940, currency: "USD", custodian: null,
  },
  {
    id: "acc_apple_card", workspaceId: "ws_personal", workspaceKind: "personal", name: "Apple Card",
    institution: "Apple", type: "credit", connection: "csv", mask: "0912", balanceCents: -142_318, currency: "USD", custodian: null,
  },
  {
    id: "acc_travel_card", workspaceId: "ws_personal", workspaceKind: "personal", name: "Travel Rewards Card",
    institution: "Northline Credit Union", type: "credit", connection: "sample", mask: "3388", balanceCents: -612_540, currency: "USD", custodian: null,
  },
];

const fromPreset = (id: string, extra: Pick<CreditCardProfile, "creditLimitCents" | "aprBasisPoints" | "statementDay" | "dueDay">): CreditCardProfile => {
  const preset = findCreditCardPreset(id);
  if (!preset) throw new Error(`Unknown card preset ${id}`);
  return { ...preset.profile, rates: preset.profile.rates.map((r) => ({ ...r })), preset: id, ...extra };
};

/** Rewards profiles for the sample cards, keyed by fixture account id. */
export const MOCK_CARD_PROFILES: Record<string, CreditCardProfile> = {
  acc_biz_card: fromPreset("business_1_5", { creditLimitCents: 2_500_000, aprBasisPoints: 2_249, statementDay: 3, dueDay: 28 }),
  acc_apple_card: fromPreset("apple_card", { creditLimitCents: 800_000, aprBasisPoints: 2_624, statementDay: 31, dueDay: 31 }),
  acc_travel_card: fromPreset("travel_3x", { creditLimitCents: 1_500_000, aprBasisPoints: 2_399, statementDay: 18, dueDay: 13 }),
};

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

export const MOCK_TAX_PROFILE = {
  estimatedEffectiveRatePercent: 28,
  priorYearTotalTaxCents: 3_120_000,
  priorYearAgiCents: 11_850_000,
  safeHarborMethod: "prior_year_110",
} as const;

export const MOCK_INVOICES: Invoice[] = [
  { id: "inv_1001", workspaceId: "ws_business", number: "INV-1001", client: "Northwind Studio", issueDate: "2026-09-02", dueDate: "2026-10-02", amountCents: 480_000, status: "paid", paidDate: "2026-09-28" },
  { id: "inv_1002", workspaceId: "ws_business", number: "INV-1002", client: "Juniper Labs", issueDate: "2026-09-20", dueDate: "2026-10-20", amountCents: 315_000, status: "overdue", paidDate: null },
  { id: "inv_1003", workspaceId: "ws_business", number: "INV-1003", client: "Atlas & Co.", issueDate: "2026-10-10", dueDate: "2026-11-09", amountCents: 620_000, status: "sent", paidDate: null },
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

  const push: Push = (kind, ws, accountId, date, amountCents, description, category, counterparty, source = "plaid") => {
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

  addCardTransactions(today, push);

  return out.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
}

type Push = (
  kind: Transaction["kind"], ws: WorkspaceKind, accountId: string, date: Date, amountCents: number,
  description: string, category: string, counterparty: string | null, source?: TransactionSource,
) => void;

/**
 * Credit card spending, on its own random stream so the cash account data
 * above stays exactly as it was. Some spending is on the "wrong" card on
 * purpose, so the optimizer has something to suggest.
 */
const CARD_SPEND: [WorkspaceKind, string, string, string, number, number, number][] = [
  // workspace, account, description, category, times per month, min cents, max cents
  ["business", "acc_biz_card", "API usage", "Software", 1, 2_000, 8_000],
  ["business", "acc_biz_card", "Client dinner", "Dining", 2, 6_000, 18_000],
  ["business", "acc_biz_card", "Office supplies", "Shopping", 1, 4_000, 15_000],
  ["personal", "acc_apple_card", "Corner bistro", "Dining", 3, 2_500, 9_500],
  ["personal", "acc_apple_card", "Rideshare", "Transit", 2, 1_400, 4_200],
  ["personal", "acc_apple_card", "Video streaming", "Streaming", 1, 1_799, 1_799],
  ["personal", "acc_apple_card", "Online order", "Shopping", 2, 2_000, 12_000],
  ["personal", "acc_travel_card", "Neighborhood market", "Groceries", 3, 4_500, 13_000],
  ["personal", "acc_travel_card", "Gas station", "Gas", 2, 3_800, 6_200],
  ["personal", "acc_travel_card", "Coffee", "Dining", 4, 450, 900],
];

function addCardTransactions(today: Date, push: Push) {
  const rand = mulberry32(7_331);
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  for (let offset = -12; offset <= 0; offset++) {
    const start = monthStart(today, offset);
    const days = daysInMonth(start);
    const day = (n: number) => addDays(start, Math.min(n, days) - 1);
    const spent = new Map<string, number>();
    for (const [ws, accountId, desc, cat, times, min, max] of CARD_SPEND) {
      for (let i = 0; i < times; i++) {
        const amount = between(min, max);
        push("expense", ws, accountId, day(between(1, 28)), -amount, desc, cat, null, accountId === "acc_apple_card" ? "csv" : "plaid");
        spent.set(accountId, (spent.get(accountId) ?? 0) + amount);
      }
    }
    // A trip every quarter on the business card.
    if (offset % 3 === 0) {
      const amount = between(28_000, 65_000);
      push("expense", "business", "acc_biz_card", day(between(5, 20)), -amount, "Flight to client site", "Travel", null);
      spent.set("acc_biz_card", (spent.get("acc_biz_card") ?? 0) + amount);
    }
    // Each month's card spending is paid from checking on the 25th.
    for (const [accountId, amount] of spent) {
      const ws: WorkspaceKind = accountId === "acc_biz_card" ? "business" : "personal";
      const checking = ws === "business" ? "acc_biz_checking" : "acc_personal_checking";
      const name = MOCK_ACCOUNTS.find((a) => a.id === accountId)!.name;
      push("transfer", ws, checking, day(25), -amount, `${name} payment`, "Card payment", name);
      push("transfer", ws, accountId, day(25), amount, "Payment received", "Card payment", null, accountId === "acc_apple_card" ? "csv" : "plaid");
    }
  }
}
