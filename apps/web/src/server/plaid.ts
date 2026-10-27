import "server-only";
import { plaidServiceFromEnv, type PlaidService } from "@repo/api-server";

const globalForPlaid = globalThis as unknown as { __plaid?: PlaidService | null };

/** Plaid client from env, or null when PLAID_CLIENT_ID, PLAID_SECRET, or PLAID_TOKEN_KEY is missing. */
export function getPlaid(): PlaidService | null {
  if (globalForPlaid.__plaid === undefined) globalForPlaid.__plaid = plaidServiceFromEnv();
  return globalForPlaid.__plaid;
}
