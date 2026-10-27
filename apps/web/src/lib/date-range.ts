export type DateRangePreset = "7d" | "30d" | "90d" | "ytd" | "12m" | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export const DATE_PRESETS: { value: Exclude<DateRangePreset, "custom">; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "12m", label: "Last 12 months" },
];

const pad = (n: number) => String(n).padStart(2, "0");
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function rangeForPreset(preset: Exclude<DateRangePreset, "custom">, today = new Date()): DateRange {
  const to = toIsoDate(today);
  const back = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days + 1);
    return toIsoDate(d);
  };
  switch (preset) {
    case "7d":
      return { preset, from: back(7), to };
    case "30d":
      return { preset, from: back(30), to };
    case "90d":
      return { preset, from: back(90), to };
    case "ytd":
      return { preset, from: `${today.getFullYear()}-01-01`, to };
    case "12m": {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return { preset, from: toIsoDate(d), to };
    }
  }
}

export function describeRange(range: DateRange): string {
  const preset = DATE_PRESETS.find((p) => p.value === range.preset);
  if (preset) return preset.label;
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(range.from)} to ${fmt(range.to)}`;
}

export const DEFAULT_DATE_RANGE_PRESET = "90d" as const;
