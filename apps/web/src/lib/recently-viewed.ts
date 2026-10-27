"use client";
import * as React from "react";
import { safeStorage, STORAGE_KEYS } from "./storage";

export interface RecentItem {
  href: string;
  label: string;
  kind: "income" | "expense" | "investment";
  amountCents?: number;
  viewedAt: string;
}

const MAX_ITEMS = 8;
const EVENT = "recently-viewed-change";

export function recordRecentlyViewed(item: Omit<RecentItem, "viewedAt">) {
  const list = safeStorage.get<RecentItem[]>(STORAGE_KEYS.recentlyViewed, []);
  const next = [{ ...item, viewedAt: new Date().toISOString() }, ...list.filter((i) => i.href !== item.href)].slice(0, MAX_ITEMS);
  safeStorage.set(STORAGE_KEYS.recentlyViewed, next);
  window.dispatchEvent(new Event(EVENT));
}

export function useRecentlyViewed(): RecentItem[] {
  const [items, setItems] = React.useState<RecentItem[]>([]);
  React.useEffect(() => {
    const read = () => setItems(safeStorage.get<RecentItem[]>(STORAGE_KEYS.recentlyViewed, []));
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return items;
}

/** Record a view once when a detail page has loaded its data. */
export function useRecordView(item: Omit<RecentItem, "viewedAt"> | null) {
  const key = item?.href;
  React.useEffect(() => {
    if (item) recordRecentlyViewed(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
