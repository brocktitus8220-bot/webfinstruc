"use client";
import * as React from "react";
import { type DateRange, DEFAULT_DATE_RANGE_PRESET, rangeForPreset } from "@/lib/date-range";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";

export type QuickAction = "income" | "expense" | "invoice";

interface ShellState {
  /** null means "all accounts". */
  accountSelection: string[] | null;
  setAccountSelection: (ids: string[] | null) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  quickAction: QuickAction | null;
  openQuickAction: (action: QuickAction | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  cheatSheetOpen: boolean;
  setCheatSheetOpen: (open: boolean) => void;
}

const ShellStateContext = React.createContext<ShellState | null>(null);

export function ShellStateProvider({ children }: { children: React.ReactNode }) {
  const [accountSelection, setAccountSelectionState] = React.useState<string[] | null>(null);
  const [dateRange, setDateRangeState] = React.useState<DateRange>(() => rangeForPreset(DEFAULT_DATE_RANGE_PRESET));
  const [quickAction, openQuickAction] = React.useState<QuickAction | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [cheatSheetOpen, setCheatSheetOpen] = React.useState(false);

  // Restore per-browser preferences after mount to keep hydration stable.
  React.useEffect(() => {
    setAccountSelectionState(safeStorage.get<string[] | null>(STORAGE_KEYS.accountSelection, null));
    const saved = safeStorage.get<DateRange | null>(STORAGE_KEYS.dateRange, null);
    if (saved) setDateRangeState(saved.preset === "custom" ? saved : rangeForPreset(saved.preset));
  }, []);

  const setAccountSelection = React.useCallback((ids: string[] | null) => {
    setAccountSelectionState(ids);
    safeStorage.set(STORAGE_KEYS.accountSelection, ids);
  }, []);
  const setDateRange = React.useCallback((range: DateRange) => {
    setDateRangeState(range);
    safeStorage.set(STORAGE_KEYS.dateRange, range);
  }, []);

  const value = React.useMemo(
    () => ({
      accountSelection, setAccountSelection, dateRange, setDateRange, quickAction, openQuickAction,
      paletteOpen, setPaletteOpen, cheatSheetOpen, setCheatSheetOpen,
    }),
    [accountSelection, setAccountSelection, dateRange, setDateRange, quickAction, paletteOpen, cheatSheetOpen],
  );
  return <ShellStateContext.Provider value={value}>{children}</ShellStateContext.Provider>;
}

export function useShellState(): ShellState {
  const ctx = React.useContext(ShellStateContext);
  if (!ctx) throw new Error("useShellState must be used inside ShellStateProvider");
  return ctx;
}
