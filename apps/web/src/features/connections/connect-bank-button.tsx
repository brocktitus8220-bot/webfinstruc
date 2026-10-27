"use client";
import { Landmark } from "lucide-react";
import type { BankConnection, WorkspaceKind } from "@repo/core";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/lib/workspace-context";
import { plaidDisabledReason, usePlaidConnect } from "./use-plaid-connect";

/**
 * Connect a bank or card through Plaid. Uses the current workspace, or asks
 * which one when viewing All. Disabled, with the reason, when Plaid is off.
 */
export function ConnectBankButton({
  label = "Connect with Plaid",
  workspaceKind,
  onConnected,
  ...props
}: Omit<ButtonProps, "onClick"> & { label?: string; workspaceKind?: WorkspaceKind; onConnected?: (c: BankConnection) => void }) {
  const { workspace } = useWorkspace();
  const plaid = usePlaidConnect();
  const reason = plaidDisabledReason(plaid.enabled);
  const fixedKind = workspaceKind ?? (workspace === "all" ? undefined : workspace);
  const start = async (kind: WorkspaceKind) => {
    const conn = await plaid.connect(kind);
    if (conn) onConnected?.(conn);
  };
  const disabled = plaid.loading || plaid.busy || Boolean(reason);
  const content = <><Landmark /> {plaid.busy ? "Connecting" : label}</>;

  if (fixedKind || disabled) {
    return (
      <Button {...props} disabled={disabled} title={reason ?? undefined} onClick={() => fixedKind && start(fixedKind)}>
        {content}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button {...props}>{content}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Add accounts to</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => start("business")}>Business</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => start("personal")}>Personal</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
