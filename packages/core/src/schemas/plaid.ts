import { z } from "zod";
import { Id, IsoDateTime } from "./common";
import { WorkspaceKind } from "./workspace";

/** Whether bank connections are available on this server. */
export const PlaidStatus = z.object({
  enabled: z.boolean(),
  environment: z.enum(["sandbox", "production"]).nullable(),
});
export type PlaidStatus = z.infer<typeof PlaidStatus>;

export const ConnectionStatus = z.enum(["active", "login_required", "pending_expiration", "error"]);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

/** One bank login (a Plaid Item). The access token never leaves the server. */
export const BankConnection = z.object({
  id: Id,
  workspaceKind: WorkspaceKind,
  institutionName: z.string(),
  status: ConnectionStatus,
  errorCode: z.string().nullable(),
  lastSyncedAt: IsoDateTime.nullable(),
  accountIds: z.array(Id),
});
export type BankConnection = z.infer<typeof BankConnection>;

export const CreateLinkTokenInput = z.object({
  workspaceKind: WorkspaceKind,
  /** Set to repair an existing connection (Plaid update mode). */
  connectionId: Id.optional(),
});
export type CreateLinkTokenInput = z.infer<typeof CreateLinkTokenInput>;

export const LinkToken = z.object({ linkToken: z.string().min(1), expiration: z.string() });
export type LinkToken = z.infer<typeof LinkToken>;

export const ExchangePublicTokenInput = z.object({
  publicToken: z.string().min(1),
  workspaceKind: WorkspaceKind,
  institutionName: z.string().max(200).optional(),
});
export type ExchangePublicTokenInput = z.infer<typeof ExchangePublicTokenInput>;

export const SyncResult = z.object({
  added: z.number().int().nonnegative(),
  modified: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});
export type SyncResult = z.infer<typeof SyncResult>;
