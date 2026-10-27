"use client";
import { useRouter } from "next/navigation";
import { FilePlus2, Keyboard, Layers, Minus, Moon, Plus, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { APP_NAV, SETTINGS_NAV } from "@/lib/nav";
import { WORKSPACE_OPTIONS } from "@/lib/workspace";
import { useWorkspace } from "@/lib/workspace-context";
import { useShellState } from "./shell-state";

export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { setWorkspace } = useWorkspace();
  const { paletteOpen, setPaletteOpen, openQuickAction, setCheatSheetOpen } = useShellState();

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0" hideClose aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command loop>
          <CommandInput placeholder="Type a command or search" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => run(() => openQuickAction("income"))}><Plus /> Add income</CommandItem>
              <CommandItem onSelect={() => run(() => openQuickAction("expense"))}><Minus /> Add expense</CommandItem>
              <CommandItem onSelect={() => run(() => openQuickAction("invoice"))}><FilePlus2 /> Log invoice</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              {APP_NAV.map((item) => (
                <CommandItem key={item.href} value={`Go to ${item.label}`} onSelect={() => run(() => router.push(item.href))}>
                  <item.icon /> {item.label}
                  {item.shortcut && <span className="ml-auto flex gap-0.5"><Kbd>g</Kbd><Kbd>{item.shortcut}</Kbd></span>}
                </CommandItem>
              ))}
              {SETTINGS_NAV.map((s) => (
                <CommandItem key={s.slug} value={`Settings ${s.label}`} onSelect={() => run(() => router.push(`/app/settings/${s.slug}`))}>
                  <Settings2 /> Settings: {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Workspace">
              {WORKSPACE_OPTIONS.map((o) => (
                <CommandItem key={o.value} value={`Switch workspace ${o.label}`} onSelect={() => run(() => setWorkspace(o.value))}>
                  <Layers /> Switch to {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Preferences">
              <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                {resolvedTheme === "dark" ? <Sun /> : <Moon />} Toggle theme
              </CommandItem>
              <CommandItem onSelect={() => run(() => setCheatSheetOpen(true))}>
                <Keyboard /> Keyboard shortcuts <span className="ml-auto"><Kbd>?</Kbd></span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
