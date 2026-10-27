"use client";
import { Briefcase, Layers, User } from "lucide-react";
import type { WorkspaceScope } from "@repo/core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WORKSPACE_OPTIONS } from "@/lib/workspace";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";

const ICONS: Record<WorkspaceScope, typeof Briefcase> = { business: Briefcase, personal: User, all: Layers };

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspace, setWorkspace } = useWorkspace();

  if (collapsed) {
    const Icon = ICONS[workspace];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`Workspace: ${workspace}`} className="mx-auto">
            <Icon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={workspace} onValueChange={(v) => setWorkspace(v as WorkspaceScope)}>
            {WORKSPACE_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div role="radiogroup" aria-label="Workspace" className="grid grid-cols-3 gap-0.5 rounded-md border bg-surface p-0.5">
      {WORKSPACE_OPTIONS.map((o) => {
        const active = o.value === workspace;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.description}
            onClick={() => setWorkspace(o.value)}
            className={cn(
              "rounded px-1.5 py-1 text-xs font-medium transition-colors",
              active ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
