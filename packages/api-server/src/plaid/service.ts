import { createPlaidApi, type PlaidApi, type PlaidEnvironment } from "./api";
import { parseTokenKey } from "./crypto";

/** Everything the API needs to talk to Plaid. Null when Plaid is not configured. */
export interface PlaidService {
  api: PlaidApi;
  env: PlaidEnvironment;
  tokenKey: Buffer;
  webhookUrl?: string;
  redirectUri?: string;
}

/**
 * Build the Plaid service from environment variables. Returns null unless
 * PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_TOKEN_KEY are all set, so the
 * app keeps working without Plaid.
 */
export function plaidServiceFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl?: typeof fetch): PlaidService | null {
  const clientId = env.PLAID_CLIENT_ID?.trim();
  const secret = env.PLAID_SECRET?.trim();
  const tokenKey = env.PLAID_TOKEN_KEY?.trim();
  if (!clientId || !secret || !tokenKey) return null;
  const plaidEnv: PlaidEnvironment = env.PLAID_ENV === "production" ? "production" : "sandbox";
  return {
    api: createPlaidApi({ clientId, secret, env: plaidEnv }, fetchImpl),
    env: plaidEnv,
    tokenKey: parseTokenKey(tokenKey),
    webhookUrl: env.PLAID_WEBHOOK_URL?.trim() || undefined,
    redirectUri: env.PLAID_REDIRECT_URI?.trim() || undefined,
  };
}
