import { and, eq } from "drizzle-orm";
import type { WorkspaceKind } from "@repo/core";
import { type Database, schema } from "@repo/db";
import { newId } from "./ids";

/** Who is calling, as the auth layer reports it. */
export interface Identity {
  id: string;
  email: string;
  name: string;
}

const DEFAULT_WORKSPACE_NAMES: Record<WorkspaceKind, string> = {
  business: "Business",
  personal: "Personal",
};

/**
 * Make sure the user and both workspaces exist. Safe to call on every
 * request: it only inserts what is missing and never overwrites.
 */
export async function ensureUser(db: Database, identity: Identity): Promise<void> {
  await db
    .insert(schema.users)
    .values({ id: identity.id, email: identity.email, name: identity.name })
    .onConflictDoNothing();

  for (const kind of ["business", "personal"] as const) {
    await db
      .insert(schema.workspaces)
      .values({ id: newId("ws"), userId: identity.id, kind, name: DEFAULT_WORKSPACE_NAMES[kind] })
      .onConflictDoNothing();
  }
}

export async function getWorkspaceId(db: Database, userId: string, kind: WorkspaceKind): Promise<string> {
  const [row] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(and(eq(schema.workspaces.userId, userId), eq(schema.workspaces.kind, kind)));
  if (!row) throw new Error(`Missing ${kind} workspace for user ${userId}`);
  return row.id;
}
