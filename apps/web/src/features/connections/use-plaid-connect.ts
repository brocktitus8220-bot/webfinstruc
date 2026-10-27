"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BankConnection, WorkspaceKind } from "@repo/core";
import { API_MODE, useApi, useApiQuery } from "@/lib/api";
import { openPlaidLink, type PendingLink, savePendingLink } from "@/lib/plaid-link";

export const usePlaidStatus = () => useApiQuery(["plaid-status"], (api) => api.getPlaidStatus());
export const useConnections = () => useApiQuery(["connections"], (api) => api.listConnections());

/** Why the connect button is off, or null when it works. */
export function plaidDisabledReason(enabled: boolean | undefined): string | null {
  if (enabled) return null;
  return API_MODE === "mock"
    ? "Sample mode cannot connect banks. Run the real API with Plaid keys to turn this on."
    : "Bank connections are not set up on this server yet. Add Plaid keys to turn them on.";
}

/**
 * Start Plaid Link for a new connection, or for repairing one (update mode),
 * then save the result. Returns the connection on success.
 */
export function usePlaidConnect() {
  const api = useApi();
  const queryClient = useQueryClient();
  const status = usePlaidStatus();
  const [busy, setBusy] = React.useState(false);

  const finish = React.useCallback(
    async (pending: Omit<PendingLink, "linkToken" | "returnTo">, publicToken: string, institutionName?: string): Promise<BankConnection | null> => {
      if (pending.connectionId) {
        // Update mode returns no new token. The login is fixed; pull fresh data.
        await api.syncConnection({ params: { id: pending.connectionId } });
        toast.success("Connection repaired");
        return null;
      }
      const conn = await api.exchangePlaidPublicToken({ body: { publicToken, workspaceKind: pending.workspaceKind, institutionName } });
      toast.success(`Connected ${conn.institutionName}`, { description: `${conn.accountIds.length} account${conn.accountIds.length === 1 ? "" : "s"} added` });
      return conn;
    },
    [api],
  );

  const connect = React.useCallback(
    async (workspaceKind: WorkspaceKind, connectionId?: string): Promise<BankConnection | null> => {
      setBusy(true);
      try {
        const { linkToken } = await api.createPlaidLinkToken({ body: { workspaceKind, connectionId } });
        savePendingLink({ linkToken, workspaceKind, connectionId, returnTo: window.location.pathname + window.location.search });
        const result = await openPlaidLink(linkToken);
        if (!result) return null;
        return await finish({ workspaceKind, connectionId }, result.publicToken, result.metadata.institution?.name);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not connect");
        return null;
      } finally {
        setBusy(false);
        void queryClient.invalidateQueries();
      }
    },
    [api, finish, queryClient],
  );

  return { enabled: status.data?.enabled ?? false, loading: status.isLoading, busy, connect, finish };
}
