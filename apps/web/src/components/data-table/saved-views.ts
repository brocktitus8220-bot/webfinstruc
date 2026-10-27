"use client";
import * as React from "react";
import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";

export interface TableViewState {
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
}

export interface SavedView {
  id: string;
  name: string;
  state: TableViewState;
  createdAt: string;
}

/** Saved views live in localStorage for now; they move to the API later. */
export function useSavedViews(tableId: string) {
  const key = STORAGE_KEYS.savedViews(tableId);
  const [list, setList] = React.useState<SavedView[]>([]);

  React.useEffect(() => setList(safeStorage.get<SavedView[]>(key, [])), [key]);

  const commit = React.useCallback(
    (next: SavedView[]) => {
      setList(next);
      safeStorage.set(key, next);
    },
    [key],
  );

  return {
    list,
    save(name: string, state: TableViewState): SavedView {
      const view = { id: `view_${Date.now().toString(36)}`, name, state, createdAt: new Date().toISOString() };
      commit([...list, view]);
      return view;
    },
    update(id: string, state: TableViewState) {
      commit(list.map((v) => (v.id === id ? { ...v, state } : v)));
    },
    remove(id: string) {
      commit(list.filter((v) => v.id !== id));
    },
  };
}
