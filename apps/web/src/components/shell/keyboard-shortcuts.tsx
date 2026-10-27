"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { APP_NAV } from "@/lib/nav";
import { createGoToSequence, isTypingTarget, SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { useShellState } from "./shell-state";

const GO_TO = Object.fromEntries(APP_NAV.filter((n) => n.shortcut).map((n) => [n.shortcut!, n.href]));

/** Global keyboard shortcuts for the app shell. */
export function useGlobalShortcuts() {
  const router = useRouter();
  const { setPaletteOpen, setCheatSheetOpen, paletteOpen } = useShellState();
  const sequence = React.useRef(createGoToSequence());

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K toggles the palette, even from a field.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return;
      if (isTypingTarget(e.target as HTMLElement | null)) return;
      // Leave keys alone while any dialog or menu is open.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;

      if (e.key === "?") {
        e.preventDefault();
        setCheatSheetOpen(true);
        return;
      }
      const target = sequence.current(e.key.toLowerCase());
      if (target && GO_TO[target]) {
        e.preventDefault();
        router.push(GO_TO[target]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, setPaletteOpen, setCheatSheetOpen, paletteOpen]);
}

export function ShortcutCheatSheet() {
  const { cheatSheetOpen, setCheatSheetOpen } = useShellState();
  return (
    <Dialog open={cheatSheetOpen} onOpenChange={setCheatSheetOpen}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</h3>
              <ul className="divide-y rounded-md border">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{item.label}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={k + i}>
                          {i > 0 && group.title === "Go to" && <span className="text-2xs text-muted-foreground">then</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-muted-foreground">Single-key shortcuts are off while you type in a field.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
