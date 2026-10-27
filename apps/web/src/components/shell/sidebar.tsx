"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/logo";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { APP_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { useShellState } from "./shell-state";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { setCheatSheetOpen } = useShellState();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 md:flex",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center" : "px-4")}>
        <Link href="/app/overview" aria-label="Overview">
          <Logo collapsed={collapsed} />
        </Link>
      </div>

      <div className={cn("py-3", collapsed ? "px-2" : "px-3")}>
        {!collapsed && <div className="mb-1.5 px-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Workspace</div>}
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "px-2" : "px-3")} aria-label="Main">
        {APP_NAV.map((item) => {
          const section = item.href.split("/").slice(0, 3).join("/");
          const active = pathname === section || pathname.startsWith(`${section}/`);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-8 items-center gap-2.5 rounded-md text-sm transition-colors",
                collapsed ? "justify-center" : "px-2",
                active ? "bg-sidebar-accent font-medium text-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.shortcut && (
                <span className="ml-auto hidden gap-0.5 group-hover:flex">
                  <Kbd>g</Kbd>
                  <Kbd>{item.shortcut}</Kbd>
                </span>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} content={item.label}>{link}</Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className={cn("flex items-center gap-1 border-t border-sidebar-border py-2", collapsed ? "flex-col px-2" : "px-3")}>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCheatSheetOpen(true)}
            className="flex items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Kbd>?</Kbd> Shortcuts
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", !collapsed && "ml-auto")}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
