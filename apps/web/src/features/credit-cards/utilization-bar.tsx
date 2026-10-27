import { UTILIZATION_WARNING_BASIS_POINTS } from "@repo/core";
import { cn } from "@/lib/utils";
import { formatBasisPoints } from "./use-card-analysis";

/** Owed over limit. Green under 10%, amber to 30%, red above. */
export function UtilizationBar({ basisPoints }: { basisPoints: number | null }) {
  if (basisPoints === null) return <span className="text-xs text-muted-foreground">Add a limit</span>;
  const tone = basisPoints > UTILIZATION_WARNING_BASIS_POINTS ? "bg-negative" : basisPoints > 1_000 ? "bg-warning" : "bg-positive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={basisPoints / 100} aria-label="Utilization">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, basisPoints / 100)}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular">{formatBasisPoints(basisPoints)}</span>
    </div>
  );
}
