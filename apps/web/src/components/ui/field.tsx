import * as React from "react";
import { Label } from "./label";

/** Label + control + error message, for Zod-validated forms. */
export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | undefined; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-negative">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
