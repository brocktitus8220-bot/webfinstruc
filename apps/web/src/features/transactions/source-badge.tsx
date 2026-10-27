import type { TransactionSource } from "@repo/core";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<TransactionSource, string> = { plaid: "Bank sync", manual: "Manual", other: "Other" };

export function SourceBadge({ source }: { source: TransactionSource }) {
  return <Badge variant={source === "manual" ? "primary" : "outline"}>{LABELS[source]}</Badge>;
}

export const sourceLabel = (s: TransactionSource) => LABELS[s];
