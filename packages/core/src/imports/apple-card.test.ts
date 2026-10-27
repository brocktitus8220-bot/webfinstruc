import { describe, expect, it } from "vitest";
import { parseAppleCardCsv } from "./apple-card";
import { parseCsv } from "./csv";

const SAMPLE = [
  "Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By",
  '10/02/2026,10/03/2026,"BLUE BOTTLE COFFEE 123 MAIN ST, OAKLAND CA",Blue Bottle Coffee,Restaurants,Purchase,6.50,Alex Rivera',
  "10/04/2026,10/05/2026,TRADER JOE S #123,Trader Joe's,Grocery,Purchase,84.23,Alex Rivera",
  "10/04/2026,10/05/2026,TRADER JOE S #123,Trader Joe's,Grocery,Purchase,84.23,Alex Rivera",
  "10/10/2026,10/10/2026,ACH DEPOSIT INTERNET TRANSFER,Payment,Payment,Payment,-500.00,Alex Rivera",
  "10/12/2026,10/13/2026,RETURN AMAZON,Amazon,Shopping,Credit,-19.99,Alex Rivera",
  "10/15/2026,10/15/2026,MONTHLY INSTALLMENTS,Apple,Other,Installment,41.62,Alex Rivera",
  "13/40/2026,,BAD,Bad,Other,Purchase,1.00,Alex Rivera",
].join("\r\n");

describe("parseCsv", () => {
  it("handles quotes, commas, doubled quotes, and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([["a", "b, c", 'say "hi"'], ["1", "2", "3"]]);
  });
});

describe("parseAppleCardCsv", () => {
  const result = parseAppleCardCsv(SAMPLE);

  it("flips signs: purchases negative, payments and refunds positive", () => {
    const amounts = result.rows.map((r) => r.amountCents);
    expect(amounts).toEqual([-650, -8423, -8423, 50000, 1999, -4162]);
  });

  it("maps types and categories", () => {
    expect(result.rows[0]).toMatchObject({ kind: "expense", category: "Dining", counterparty: "Blue Bottle Coffee" });
    expect(result.rows[1]).toMatchObject({ kind: "expense", category: "Groceries" });
    expect(result.rows[3]).toMatchObject({ kind: "transfer", category: "Card payment" });
    expect(result.rows[4]).toMatchObject({ kind: "transfer", category: "Refund" });
    expect(result.rows[5]).toMatchObject({ kind: "expense", category: "Other" });
  });

  it("gives identical rows distinct, stable ids", () => {
    expect(result.rows[1]!.externalId).not.toBe(result.rows[2]!.externalId);
    expect(parseAppleCardCsv(SAMPLE).rows.map((r) => r.externalId)).toEqual(result.rows.map((r) => r.externalId));
  });

  it("reports bad lines and the date range", () => {
    expect(result.errors).toEqual([{ line: 8, message: 'Unreadable date "13/40/2026"' }]);
    expect(result.from).toBe("2026-10-02");
    expect(result.to).toBe("2026-10-15");
  });

  it("rejects files from other banks", () => {
    const other = parseAppleCardCsv("Date,Payee,Amount\n2026-10-01,Coffee,5.00");
    expect(other.rows).toEqual([]);
    expect(other.errors[0]!.message).toMatch(/Apple Card export/);
  });
});
