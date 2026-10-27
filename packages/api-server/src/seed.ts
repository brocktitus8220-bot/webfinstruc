import { eq, inArray } from "drizzle-orm";
import { toBasisPoints } from "@repo/core";
import {
  buildMockTransactions,
  MOCK_ACCOUNTS,
  MOCK_HOLDINGS,
  MOCK_INVOICES,
  MOCK_TAX_PROFILE,
} from "@repo/api-client/mock";
import { type Database, schema } from "@repo/db";
import { newId } from "./ids";
import { getWorkspaceId } from "./provision";

/** True when the user already has at least one account. */
export async function hasAccounts(db: Database, userId: string): Promise<boolean> {
  const ws = await db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.userId, userId));
  if (ws.length === 0) return false;
  const [row] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(inArray(schema.accounts.workspaceId, ws.map((w) => w.id)))
    .limit(1);
  return Boolean(row);
}

/**
 * Copy the sample data set (the same one mock mode shows) into the user's
 * workspaces. Ids are regenerated so many users can hold the sample at once.
 * Does nothing if the user already has accounts.
 */
export async function seedSampleData(db: Database, userId: string, now = new Date()): Promise<boolean> {
  if (await hasAccounts(db, userId)) return false;

  const workspaceIds = {
    business: await getWorkspaceId(db, userId, "business"),
    personal: await getWorkspaceId(db, userId, "personal"),
  };
  const accountIds = new Map(MOCK_ACCOUNTS.map((a) => [a.id, newId("acc")]));
  const accountId = (fixtureId: string) => {
    const id = accountIds.get(fixtureId);
    if (!id) throw new Error(`Unknown sample account ${fixtureId}`);
    return id;
  };

  await db.transaction(async (tx) => {
    await tx.insert(schema.accounts).values(
      MOCK_ACCOUNTS.map((a) => ({
        id: accountId(a.id),
        workspaceId: workspaceIds[a.workspaceKind],
        name: a.name,
        institution: a.institution,
        type: a.type,
        mask: a.mask,
        balanceCents: a.balanceCents,
        currency: a.currency,
        custodian: a.custodian,
      })),
    );

    await tx.insert(schema.holdings).values(
      MOCK_HOLDINGS.map((h) => ({ ...h, id: newId("hold"), accountId: accountId(h.accountId) })),
    );

    const transactions = buildMockTransactions(now).map((t) => ({
      id: newId("tx"),
      workspaceId: workspaceIds[t.workspaceKind],
      accountId: accountId(t.accountId),
      date: t.date,
      amountCents: t.amountCents,
      kind: t.kind,
      description: t.description,
      counterparty: t.counterparty,
      category: t.category,
      source: t.source,
      pending: t.pending,
      notes: t.notes,
    }));
    // Insert in chunks to stay well under the bind parameter limit.
    for (let i = 0; i < transactions.length; i += 200) {
      await tx.insert(schema.transactions).values(transactions.slice(i, i + 200));
    }

    await tx.insert(schema.invoices).values(
      MOCK_INVOICES.map((inv) => ({ ...inv, id: newId("inv"), workspaceId: workspaceIds.business })),
    );

    const [onboarding] = await tx.select().from(schema.onboarding).where(eq(schema.onboarding.userId, userId));
    await tx
      .insert(schema.taxSettings)
      .values({
        userId,
        taxYear: now.getUTCFullYear(),
        filingStatus: onboarding?.filingStatus ?? "single",
        state: onboarding?.state ?? "CA",
        effectiveRateBasisPoints: toBasisPoints(MOCK_TAX_PROFILE.estimatedEffectiveRatePercent),
        priorYearTotalTaxCents: MOCK_TAX_PROFILE.priorYearTotalTaxCents,
        priorYearAgiCents: MOCK_TAX_PROFILE.priorYearAgiCents,
        safeHarborMethod: MOCK_TAX_PROFILE.safeHarborMethod,
      })
      .onConflictDoNothing();
  });
  return true;
}
