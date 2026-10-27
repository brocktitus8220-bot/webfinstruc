"use client";
import * as React from "react";
import { SIDEBAR_COOKIE } from "@/lib/workspace";
import { CommandPalette } from "./command-palette";
import { Header } from "./header";
import { ShortcutCheatSheet, useGlobalShortcuts } from "./keyboard-shortcuts";
import { QuickActionDialogs } from "./quick-actions";
import { Sidebar } from "./sidebar";

export function AppShell({ initialCollapsed, children }: { initialCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  useGlobalShortcuts();

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${!c}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
      <CommandPalette />
      <QuickActionDialogs />
      <ShortcutCheatSheet />
    </div>
  );
}
