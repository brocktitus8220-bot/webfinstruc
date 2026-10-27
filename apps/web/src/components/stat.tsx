import * as React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Stat({ label, value, sub, loading, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; loading?: boolean; className?: string }) {
  return (
    <Card className={cn("px-4 py-3", className)}>
      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {loading ? <Skeleton className="mt-1.5 h-6 w-28" /> : <div className="mt-0.5 text-xl font-semibold tabular">{value}</div>}
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
