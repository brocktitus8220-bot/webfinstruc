import { PRODUCT_NAME } from "@repo/core/config";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground", className)} aria-hidden>
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    </span>
  );
}

export function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      {!collapsed && <span className="text-base">{PRODUCT_NAME}</span>}
    </span>
  );
}
