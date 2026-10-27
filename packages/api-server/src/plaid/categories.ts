import type { TransactionKind } from "@repo/core";
import type { PlaidTransaction } from "./api";

/** Detailed Plaid categories that get their own label. */
const DETAILED: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  TRANSPORTATION_GAS: "Gas",
  ENTERTAINMENT_TV_AND_MOVIES: "Streaming",
  RENT_AND_UTILITIES_RENT: "Rent",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "Pharmacy",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Card payment",
  INCOME_WAGES: "Wages",
  GENERAL_SERVICES_INSURANCE: "Insurance",
};

/** Plaid personal finance categories (primary) mapped to our labels. */
const PRIMARY: Record<string, string> = {
  INCOME: "Income",
  TRANSFER_IN: "Transfer",
  TRANSFER_OUT: "Transfer",
  LOAN_PAYMENTS: "Loan payment",
  BANK_FEES: "Fees",
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Dining",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Home",
  MEDICAL: "Health",
  PERSONAL_CARE: "Personal care",
  GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT: "Taxes and fees",
  TRANSPORTATION: "Transit",
  TRAVEL: "Travel",
  RENT_AND_UTILITIES: "Utilities",
};

const TRANSFER_PRIMARIES = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS"]);

export interface MappedTransaction {
  amountCents: number;
  kind: TransactionKind;
  category: string;
  description: string;
  counterparty: string | null;
}

/** Convert a Plaid transaction to our sign, kind, and category. */
export function mapPlaidTransaction(t: PlaidTransaction, accountType: "checking" | "savings" | "credit"): MappedTransaction {
  // Plaid: positive is money out. Ours: positive is money in.
  const amountCents = -Math.round(t.amount * 100);
  const primary = t.personal_finance_category?.primary ?? "";
  const detailed = t.personal_finance_category?.detailed ?? "";
  let category = DETAILED[detailed] ?? PRIMARY[primary] ?? "Other";

  let kind: TransactionKind;
  if (TRANSFER_PRIMARIES.has(primary)) kind = "transfer";
  else if (primary === "INCOME") kind = "income";
  else if (amountCents < 0) kind = "expense";
  else if (accountType === "credit") {
    // Money back onto a card that is not a payment is a refund.
    kind = "transfer";
    category = "Refund";
  } else kind = "income";

  return {
    amountCents,
    kind,
    category,
    description: (t.name || t.merchant_name || "Transaction").slice(0, 500),
    counterparty: t.merchant_name ?? null,
  };
}

/** Plaid account type and subtype to ours. Null for types this app does not import. */
export function mapPlaidAccountType(type: string, subtype: string | null): "checking" | "savings" | "credit" | null {
  if (type === "credit") return "credit";
  if (type !== "depository") return null;
  return subtype && ["savings", "money market", "cd"].includes(subtype) ? "savings" : "checking";
}
