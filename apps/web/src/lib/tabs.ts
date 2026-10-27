/**
 * Sub-tabs are always a `tab` search param, for example
 * /app/overview?tab=forecast. The first tab is the default and omits the param.
 */
export function resolveTab<T extends readonly string[]>(tabs: T, value: string | string[] | undefined): T[number] {
  const v = Array.isArray(value) ? value[0] : value;
  return (tabs as readonly string[]).includes(v ?? "") ? (v as T[number]) : tabs[0]!;
}

export const OVERVIEW_TABS = ["today", "forecast", "ask"] as const;
export const TAX_TABS = ["estimates", "assumptions", "safe-harbor"] as const;
export const CREDIT_CARD_TABS = ["overview", "optimize", "cards"] as const;
