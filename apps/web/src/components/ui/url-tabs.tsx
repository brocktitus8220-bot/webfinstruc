import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Sub-tabs backed by the `tab` search param. Plain links, so tabs survive
 * refresh and work with back and forward.
 */
export function UrlTabs<T extends string>({
  basePath,
  tabs,
  active,
  labels,
}: {
  basePath: string;
  tabs: readonly T[];
  active: T;
  labels: Record<T, string>;
}) {
  return (
    <nav className="flex items-center gap-1 border-b" aria-label="Sections">
      {tabs.map((tab, i) => {
        const href = i === 0 ? basePath : `${basePath}?tab=${tab}`;
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
