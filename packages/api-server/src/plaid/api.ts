import { PRODUCT_NAME } from "@repo/core/config";

/**
 * A small Plaid REST client over fetch. Only the calls this app uses.
 * Docs: https://plaid.com/docs/api/
 */

export type PlaidEnvironment = "sandbox" | "production";

const BASE_URLS: Record<PlaidEnvironment, string> = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

export interface PlaidCredentials {
  clientId: string;
  secret: string;
  env: PlaidEnvironment;
}

/** Error body Plaid returns on 4xx and 5xx. */
export class PlaidApiError extends Error {
  override name = "PlaidApiError";
  constructor(
    readonly status: number,
    readonly errorType: string,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask: string | null;
  type: "depository" | "credit" | "loan" | "investment" | "other" | string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  /** Positive is money out of the account, the opposite of our convention. */
  amount: number;
  iso_currency_code: string | null;
  date: string;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  personal_finance_category?: { primary: string; detailed: string } | null;
}

export interface TransactionsSyncResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string; account_id?: string }[];
  next_cursor: string;
  has_more: boolean;
}

export interface PlaidJwk {
  alg: string;
  crv: string;
  kid: string;
  kty: string;
  use: string;
  x: string;
  y: string;
  created_at: number;
  expired_at: number | null;
}

export interface LinkTokenRequest {
  userId: string;
  /** Update mode: repair an existing Item instead of adding a new one. */
  accessToken?: string;
  webhookUrl?: string;
  redirectUri?: string;
}

export interface PlaidApi {
  linkTokenCreate(req: LinkTokenRequest): Promise<{ link_token: string; expiration: string }>;
  itemPublicTokenExchange(publicToken: string): Promise<{ access_token: string; item_id: string }>;
  accountsGet(accessToken: string): Promise<{ accounts: PlaidAccount[]; item: { item_id: string; institution_id?: string | null } }>;
  transactionsSync(accessToken: string, cursor: string | null): Promise<TransactionsSyncResponse>;
  itemRemove(accessToken: string): Promise<void>;
  webhookVerificationKeyGet(keyId: string): Promise<{ key: PlaidJwk }>;
}

export function createPlaidApi(creds: PlaidCredentials, fetchImpl: typeof fetch = fetch): PlaidApi {
  const base = BASE_URLS[creds.env];
  const call = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "plaid-version": "2020-09-14" },
      body: JSON.stringify({ client_id: creds.clientId, secret: creds.secret, ...body }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new PlaidApiError(
        res.status,
        String(data.error_type ?? "API_ERROR"),
        String(data.error_code ?? "UNKNOWN"),
        String(data.error_message ?? `Plaid request to ${path} failed`),
      );
    }
    return data as T;
  };

  return {
    linkTokenCreate: ({ userId, accessToken, webhookUrl, redirectUri }) =>
      call("/link/token/create", {
        client_name: PRODUCT_NAME,
        language: "en",
        country_codes: ["US"],
        user: { client_user_id: userId },
        ...(accessToken
          ? { access_token: accessToken }
          : {
              products: ["transactions"],
              transactions: { days_requested: 730 },
              // Cash and credit cards only. Investments keep their own self-managed and custodian views.
              account_filters: {
                depository: { account_subtypes: ["checking", "savings", "money market", "cd"] },
                credit: { account_subtypes: ["credit card"] },
              },
            }),
        ...(webhookUrl ? { webhook: webhookUrl } : {}),
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }),
    itemPublicTokenExchange: (publicToken) => call("/item/public_token/exchange", { public_token: publicToken }),
    accountsGet: (accessToken) => call("/accounts/get", { access_token: accessToken }),
    transactionsSync: (accessToken, cursor) =>
      call("/transactions/sync", { access_token: accessToken, count: 500, ...(cursor ? { cursor } : {}) }),
    itemRemove: async (accessToken) => {
      await call("/item/remove", { access_token: accessToken });
    },
    webhookVerificationKeyGet: (keyId) => call("/webhook_verification_key/get", { key_id: keyId }),
  };
}
