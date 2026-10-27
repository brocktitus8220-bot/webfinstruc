import { NextResponse, type NextRequest } from "next/server";
import { handlePlaidWebhook, type PlaidWebhookBody, verifyPlaidWebhook } from "@repo/api-server";
import { getDb } from "@/server/db";
import { getPlaid } from "@/server/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plaid calls this when an Item has new transactions or needs attention.
 * Set PLAID_WEBHOOK_URL to this route's public URL. Requests are verified
 * with the Plaid-Verification JWT before anything is read from them.
 */
export async function POST(req: NextRequest) {
  const plaid = getPlaid();
  const db = getDb();
  if (!plaid || !db) return NextResponse.json({ message: "Plaid is not configured" }, { status: 503 });

  const raw = await req.text();
  if (!(await verifyPlaidWebhook(plaid, raw, req.headers.get("plaid-verification")))) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }
  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(raw) as PlaidWebhookBody;
  } catch {
    return NextResponse.json({ message: "Body must be JSON" }, { status: 400 });
  }
  try {
    const outcome = await handlePlaidWebhook(db, plaid, body);
    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    // A 500 makes Plaid retry later, which is what we want for a failed sync.
    console.error("[plaid webhook] failed", body.webhook_type, body.webhook_code, error);
    return NextResponse.json({ message: "Sync failed" }, { status: 500 });
  }
}
