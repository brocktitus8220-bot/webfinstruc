import { and, eq, inArray, sql } from "drizzle-orm";
import { DEFAULT_CREDIT_CARD_PROFILE, type SyncResult } from "@repo/core";
import { type Database, schema } from "@repo/db";
import { newId } from "../ids";
import { type PlaidAccount, PlaidApiError, type PlaidTransaction } from "./api";
import { mapPlaidAccountType, mapPlaidTransaction } from "./categories";
import { decryptToken } from "./crypto";
import type { PlaidService } from "./service";

const { accounts, creditCardProfiles, plaidItems, transactions } = schema;

export type PlaidItemRow = typeof plaidItems.$inferSelect;

const toCents = (dollars: number | null | undefined) => (dollars == null ? null : Math.round(dollars * 100));
/** Plaid masks are usually 4 digits but can be shorter, longer, or missing. */
const normalizeMask = (mask: string | null) => (mask ?? "").replace(/\D/g, "").slice(-4).padStart(4, "0");

/** Balance in our convention: cash is what you have, credit is negative what you owe. */
function balanceOf(a: PlaidAccount, type: "checking" | "savings" | "credit"): number {
  const current = toCents(a.balances.current) ?? 0;
  return type === "credit" ? -current : current;
}

/**
 * Create or refresh our accounts for an Item. New credit cards get a default
 * rewards profile with the limit Plaid reports. Returns plaid account id to
 * our account id and type.
 */
export async function upsertPlaidAccounts(db: Database, item: PlaidItemRow, plaidAccounts: PlaidAccount[]) {
  const map = new Map<string, { id: string; type: "checking" | "savings" | "credit" }>();
  for (const pa of plaidAccounts) {
    const type = mapPlaidAccountType(pa.type, pa.subtype);
    if (!type) continue;
    const balanceCents = balanceOf(pa, type);
    const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.plaidAccountId, pa.account_id));
    if (existing) {
      await db
        .update(accounts)
        .set({ balanceCents, plaidItemId: item.id, connection: "plaid" })
        .where(eq(accounts.id, existing.id));
      map.set(pa.account_id, { id: existing.id, type });
      continue;
    }
    const id = newId("acc");
    await db.insert(accounts).values({
      id,
      workspaceId: item.workspaceId,
      name: (pa.name || pa.official_name || "Account").slice(0, 80),
      institution: item.institutionName,
      type,
      connection: "plaid",
      plaidItemId: item.id,
      plaidAccountId: pa.account_id,
      mask: normalizeMask(pa.mask),
      balanceCents,
      currency: pa.balances.iso_currency_code ?? "USD",
    });
    if (type === "credit") {
      const { rates: _rates, ...profile } = DEFAULT_CREDIT_CARD_PROFILE;
      await db
        .insert(creditCardProfiles)
        .values({ accountId: id, ...profile, creditLimitCents: toCents(pa.balances.limit) })
        .onConflictDoNothing();
    }
    map.set(pa.account_id, { id, type });
  }
  return map;
}

/** Pull every page of changes since the stored cursor. Restarts if Plaid's data shifts mid-pagination. */
async function pullChanges(service: PlaidService, accessToken: string, startCursor: string | null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: string[] = [];
    let cursor = startCursor;
    try {
      for (;;) {
        const page = await service.api.transactionsSync(accessToken, cursor);
        added.push(...page.added);
        modified.push(...page.modified);
        removed.push(...page.removed.map((r) => r.transaction_id));
        cursor = page.next_cursor;
        if (!page.has_more) break;
      }
      return { added, modified, removed, cursor };
    } catch (error) {
      if (error instanceof PlaidApiError && error.errorCode === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") continue;
      throw error;
    }
  }
  throw new Error("Plaid transactions kept changing during sync. Try again shortly.");
}

/**
 * Refresh balances and apply new, changed, and removed transactions for one
 * Item. Writes and the cursor update happen in one database transaction, so a
 * failed sync can be retried safely.
 */
export async function syncPlaidItem(db: Database, service: PlaidService, item: PlaidItemRow, now = new Date()): Promise<SyncResult> {
  const accessToken = decryptToken(item.accessTokenEncrypted, service.tokenKey);
  try {
    const { accounts: plaidAccounts } = await service.api.accountsGet(accessToken);
    const accountMap = await upsertPlaidAccounts(db, item, plaidAccounts);
    const changes = await pullChanges(service, accessToken, item.cursor);

    const rows = [...changes.added, ...changes.modified]
      .filter((t) => accountMap.has(t.account_id))
      .map((t) => {
        const account = accountMap.get(t.account_id)!;
        const mapped = mapPlaidTransaction(t, account.type);
        return {
          id: newId("tx"),
          workspaceId: item.workspaceId,
          accountId: account.id,
          date: t.date,
          ...mapped,
          source: "plaid" as const,
          pending: t.pending,
          notes: null,
          externalId: t.transaction_id,
        };
      });

    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i += 200) {
        await tx
          .insert(transactions)
          .values(rows.slice(i, i + 200))
          .onConflictDoUpdate({
            target: [transactions.accountId, transactions.externalId],
            set: {
              date: sql`excluded.date`,
              amountCents: sql`excluded.amount_cents`,
              kind: sql`excluded.kind`,
              description: sql`excluded.description`,
              counterparty: sql`excluded.counterparty`,
              category: sql`excluded.category`,
              pending: sql`excluded.pending`,
            },
          });
      }
      const ourIds = [...new Set([...accountMap.values()].map((a) => a.id))];
      if (changes.removed.length > 0 && ourIds.length > 0) {
        await tx
          .delete(transactions)
          .where(and(inArray(transactions.accountId, ourIds), inArray(transactions.externalId, changes.removed)));
      }
      await tx
        .update(plaidItems)
        .set({ cursor: changes.cursor, lastSyncedAt: now, status: "active", errorCode: null })
        .where(eq(plaidItems.id, item.id));
    });

    return { added: changes.added.length, modified: changes.modified.length, removed: changes.removed.length };
  } catch (error) {
    if (error instanceof PlaidApiError && error.errorType === "ITEM_ERROR") {
      await markItemError(db, item.id, error.errorCode);
    }
    throw error;
  }
}

export async function markItemError(db: Database, itemId: string, errorCode: string) {
  const status = errorCode === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error";
  await db.update(plaidItems).set({ status, errorCode }).where(eq(plaidItems.id, itemId));
}
