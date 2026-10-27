"use client";
import Link from "next/link";
import { FilePlus2, Menu, Minus, Plus, Search } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { APP_NAV } from "@/lib/nav";
import { AccountSelector } from "./account-selector";
import { BalanceSummary } from "./balance-summary";
import { DateRangeSelector } from "./date-range-selector";
import { useShellState } from "./shell-state";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function Header() {
  const { openQuickAction, setPaletteOpen, setCheatSheetOpen } = useShellState();

  return (
    <header className="sticky top-0 z-30 border-b bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 lg:px-6">
        <MobileNav />
        <BalanceSummary />
        <div className="hidden h-8 w-px bg-border lg:block" />
        <div className="flex flex-wrap items-center gap-2">
          <AccountSelector />
          <DateRangeSelector />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setPaletteOpen(true)} className="hidden w-48 justify-start font-normal text-muted-foreground xl:inline-flex">
            <Search className="!size-3.5" />
            Search or jump to
            <span className="ml-auto flex gap-0.5"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          </Button>
          <Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Command palette" onClick={() => setPaletteOpen(true)}>
            <Search />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm"><Plus /> New</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openQuickAction("income")}><Plus /> Add income</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openQuickAction("expense")}><Minus /> Add expense</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openQuickAction("invoice")}><FilePlus2 /> Log invoice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts" onClick={() => setCheatSheetOpen(true)} className="hidden sm:inline-flex">
            <span className="text-sm font-semibold">?</span>
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/** Small screens get the sidebar's contents in a menu. */
function MobileNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Menu">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="p-1.5"><WorkspaceSwitcher collapsed={false} /></div>
        <DropdownMenuSeparator />
        {APP_NAV.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}><item.icon /> {item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
