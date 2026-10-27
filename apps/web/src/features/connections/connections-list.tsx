"use client";
import * as React from "react";
import { RefreshCw, Unplug, Wrench } from "lucide-react";
import { toast } from "sonner";
import type { BankConnection, ConnectionStatus } from "@repo/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useConnections, usePlaidConnect } from "./use-plaid-connect";

const STATUS: Record<ConnectionStatus, { label: string; variant: "positive" | "warning" | "negative" }> = {
  active: { label: "Connected", variant: "positive" },
  login_required: { label: "Sign in again", variant: "warning" },
  pending_expiration: { label: "Expiring soon", variant: "warning" },
  error: { label: "Error", variant: "negative" },
};

/** Bank logins made through Plaid, with sync, repair, and disconnect. */
export function ConnectionsList() {
  const connections = useConnections();
  if (!connections.data?.length) return null;
  return (
    <ul className="mb-4 divide-y rounded-md border">
      {connections.data.map((c) => <ConnectionRow key={c.id} connection={c} />)}
    </ul>
  );
}

function ConnectionRow({ connection: c }: { connection: BankConnection }) {
  const plaid = usePlaidConnect();
  const sync = useApiMutation((api, id: string) => api.syncConnection({ params: { id } }));
  const remove = useApiMutation((api, id: string) => api.removeConnection({ params: { id } }));
  const status = STATUS[c.status];
  const needsRepair = c.status === "login_required" || c.status === "pending_expiration";
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{c.institutionName}</span>
        <span className="block text-xs text-muted-foreground">
          {c.accountIds.length} account{c.accountIds.length === 1 ? "" : "s"} · <span className="capitalize">{c.workspaceKind}</span>
          {c.lastSyncedAt ? ` · Synced ${formatDate(c.lastSyncedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
        </span>
      </span>
      <Badge variant={status.variant}>{status.label}</Badge>
      {needsRepair ? (
        <Button size="sm" variant="outline" disabled={plaid.busy} onClick={() => plaid.connect(c.workspaceKind, c.id)}>
          <Wrench /> Reconnect
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={sync.isPending}
          onClick={() =>
            sync.mutate(c.id, {
              onSuccess: (r) => toast.success("Synced", { description: `${r.added} new, ${r.modified} updated, ${r.removed} removed` }),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          <RefreshCw className={sync.isPending ? "animate-spin" : undefined} /> Sync
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={remove.isPending}
        onClick={() => {
          if (!window.confirm(`Disconnect ${c.institutionName}? Its accounts and history stay, but stop updating.`)) return;
          remove.mutate(c.id, { onSuccess: () => toast.success("Disconnected"), onError: (e) => toast.error(e.message) });
        }}
      >
        <Unplug /> Disconnect
      </Button>
    </li>
  );
}
