/** localStorage that never throws (private mode, SSR, quota). */
export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota or privacy errors.
    }
  },
};

export const STORAGE_KEYS = {
  recentlyViewed: "app:recently-viewed",
  accountSelection: "app:account-selection",
  dateRange: "app:date-range",
  savedViews: (tableId: string) => `app:saved-views:${tableId}`,
  mockApi: "app:mock-api:v1",
} as const;
