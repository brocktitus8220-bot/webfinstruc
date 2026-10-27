import { parseCurrencyToCents } from "../money";
import type { StatementRow } from "../schemas/credit-card";
import { hashString, parseCsv } from "./csv";

export interface StatementParseResult {
  rows: StatementRow[];
  /** Lines that could not be read, 1-based, counting the header as line 1. */
  errors: { line: number; message: string }[];
  from: string | null;
  to: string | null;
}

const REQUIRED = ["transaction date", "description", "type", "amount (usd)"] as const;

/** Apple's categories mapped to the labels the rest of the app uses. */
const APPLE_CATEGORIES: Record<string, string> = {
  restaurants: "Dining",
  alcohol: "Dining",
  grocery: "Groceries",
  gas: "Gas",
  airlines: "Travel",
  hotels: "Travel",
  travel: "Travel",
  transportation: "Transit",
  shopping: "Shopping",
  entertainment: "Entertainment",
  medical: "Health",
  utilities: "Utilities",
  insurance: "Insurance",
};

const toIsoDate = (value: string): string | null => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const iso = `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
};

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Read an Apple Card statement export (CSV from card.apple.com or the
 * Wallet app). Apple lists purchases as positive amounts, so signs are
 * flipped to match ours: purchases negative, payments and refunds positive.
 */
export function parseAppleCardCsv(text: string): StatementParseResult {
  const table = parseCsv(text);
  const errors: StatementParseResult["errors"] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty" }], from: null, to: null };

  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `This does not look like an Apple Card export. Missing columns: ${missing.join(", ")}` }],
      from: null,
      to: null,
    };
  }
  const col = (name: string) => header.indexOf(name);
  const iDate = col("transaction date");
  const iDesc = col("description");
  const iMerchant = col("merchant");
  const iCategory = col("category");
  const iType = col("type");
  const iAmount = col("amount (usd)");

  const rows: StatementRow[] = [];
  const seen = new Map<string, number>();
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const date = toIsoDate(get(iDate));
    const appleCents = parseCurrencyToCents(get(iAmount));
    if (!date) return errors.push({ line, message: `Unreadable date "${get(iDate)}"` });
    if (appleCents === null) return errors.push({ line, message: `Unreadable amount "${get(iAmount)}"` });
    if (appleCents === 0) return;

    const type = get(iType).toLowerCase();
    const merchant = get(iMerchant) || null;
    const description = get(iDesc) || merchant || "Apple Card transaction";
    const amountCents = -appleCents;
    let kind: StatementRow["kind"];
    let category: string;
    if (type === "payment") {
      kind = "transfer";
      category = "Card payment";
    } else if (type === "credit" || type === "return" || type === "refund") {
      kind = "transfer";
      category = "Refund";
    } else if (type.includes("adjustment") || type === "daily cash") {
      kind = "transfer";
      category = "Adjustment";
    } else if (type === "interest") {
      kind = "expense";
      category = "Interest";
    } else {
      // Purchase, Installment, Debit, and anything new Apple adds.
      kind = amountCents < 0 ? "expense" : "transfer";
      const raw = get(iCategory);
      category = APPLE_CATEGORIES[raw.toLowerCase()] ?? (raw ? titleCase(raw) : "Other");
    }

    const key = `${date}|${appleCents}|${description}|${merchant ?? ""}|${type}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    rows.push({
      date,
      amountCents,
      kind,
      description: description.slice(0, 500),
      counterparty: merchant?.slice(0, 200) ?? null,
      category: category.slice(0, 80),
      externalId: `apple:${date}:${appleCents}:${hashString(key)}:${n}`,
    });
  });

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { rows, errors, from: rows[0]?.date ?? null, to: rows.at(-1)?.date ?? null };
}
