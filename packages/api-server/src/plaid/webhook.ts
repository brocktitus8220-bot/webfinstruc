import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { eq } from "drizzle-orm";
import { type Database, schema } from "@repo/db";
import type { PlaidJwk } from "./api";
import type { PlaidService } from "./service";
import { markItemError, syncPlaidItem } from "./sync";

const MAX_AGE_SECONDS = 5 * 60;
const keyCache = new Map<string, PlaidJwk>();

const b64urlJson = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

/**
 * Check the Plaid-Verification header: an ES256 JWT signed by Plaid whose
 * payload carries the SHA-256 of the exact body. Returns false on any problem.
 * https://plaid.com/docs/api/webhooks/webhook-verification/
 */
export async function verifyPlaidWebhook(service: PlaidService, rawBody: string, jwt: string | null, now = new Date()): Promise<boolean> {
  if (!jwt) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  try {
    const header = b64urlJson(headerPart);
    if (header.alg !== "ES256" || typeof header.kid !== "string") return false;

    let jwk = keyCache.get(header.kid);
    if (!jwk) {
      jwk = (await service.api.webhookVerificationKeyGet(header.kid)).key;
      keyCache.set(header.kid, jwk);
    }
    if (jwk.expired_at !== null) return false;

    const publicKey = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, format: "jwk" });
    const signed = verifySignature(
      "sha256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signaturePart, "base64url"),
    );
    if (!signed) return false;

    const payload = b64urlJson(payloadPart);
    const issuedAt = Number(payload.iat);
    if (!Number.isFinite(issuedAt) || Math.abs(now.getTime() / 1000 - issuedAt) > MAX_AGE_SECONDS) return false;
    const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    return payload.request_body_sha256 === bodyHash;
  } catch {
    return false;
  }
}

/** Test hook: forget cached verification keys. */
export const clearWebhookKeyCache = () => keyCache.clear();

export interface PlaidWebhookBody {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  error?: { error_code?: string } | null;
}

/** What a webhook did, for logs and tests. */
export type WebhookOutcome = "synced" | "status_updated" | "ignored";

/** Act on a verified webhook. Unknown items and event types are ignored. */
export async function handlePlaidWebhook(db: Database, service: PlaidService, body: PlaidWebhookBody, now = new Date()): Promise<WebhookOutcome> {
  if (!body.item_id) return "ignored";
  const [item] = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.plaidItemId, body.item_id));
  if (!item) return "ignored";

  if (body.webhook_type === "TRANSACTIONS") {
    // SYNC_UPDATES_AVAILABLE is the sync-era event; the older update codes also mean "pull now".
    await syncPlaidItem(db, service, item, now);
    return "synced";
  }
  if (body.webhook_type === "ITEM") {
    const set = (status: "active" | "login_required" | "pending_expiration" | "error", errorCode: string | null) =>
      db.update(schema.plaidItems).set({ status, errorCode }).where(eq(schema.plaidItems.id, item.id));
    switch (body.webhook_code) {
      case "ERROR":
        await markItemError(db, item.id, body.error?.error_code ?? "UNKNOWN");
        return "status_updated";
      case "PENDING_EXPIRATION":
      case "PENDING_DISCONNECT":
        await set("pending_expiration", body.webhook_code);
        return "status_updated";
      case "LOGIN_REPAIRED":
        await set("active", null);
        return "status_updated";
      case "USER_PERMISSION_REVOKED":
      case "USER_ACCOUNT_REVOKED":
        await set("error", body.webhook_code);
        return "status_updated";
    }
  }
  return "ignored";
}
