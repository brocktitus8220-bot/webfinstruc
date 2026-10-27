"use client";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { money } from "@/lib/format";
import { useAccountScope } from "@/lib/queries";
import { useShellState } from "./shell-state";

export function accountSelectorLabel(selected: number, total: number) {
  return selected === total ? `Showing all accounts (${total})` : `Showing ${selected} of ${total} accounts`;
}

export function AccountSelector() {
  const { cashAccounts, selectedAccounts, isLoading } = useAccountScope();
  const { setAccountSelection } = useShellState();
  const selectedIds = new Set(selectedAccounts.map((a) => a.id));
  const allSelected = selectedAccounts.length === cashAccounts.length;

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    // Keep at least one account selected; selecting everything means "all".
    if (next.size === 0) return;
    setAccountSelection(next.size === cashAccounts.length ? null : [...next]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading} className="font-normal">
          {isLoading ? "Loading accounts" : accountSelectorLabel(selectedAccounts.length, cashAccounts.length)}
          <ChevronDown className="!size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium">Accounts</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            disabled={allSelected}
            onClick={() => setAccountSelection(null)}
          >
            Select all
          </button>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1">
          {cashAccounts.map((a) => {
            const id = `acct-${a.id}`;
            return (
              <li key={a.id}>
                <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted">
                  <Checkbox id={id} checked={selectedIds.has(a.id)} onCheckedChange={(c) => toggle(a.id, c === true)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.name}</span>
                    <span className="block text-2xs text-muted-foreground">{a.institution} ···{a.mask}</span>
                  </span>
                  <span className="text-xs tabular text-muted-foreground">{money(a.balanceCents)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
