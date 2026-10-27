import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="border-b bg-gradient-to-b from-accent/40 to-background">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        {eyebrow && <p className="mb-3 text-xs font-medium uppercase tracking-wide text-primary">{eyebrow}</p>}
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mx-auto max-w-6xl px-4 py-14", className)}>
      {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
      {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      <div className={cn((title || description) && "mt-8")}>{children}</div>
    </section>
  );
}

export function FeatureGrid({ items }: { items: { title: string; body: string; icon?: React.ComponentType<{ className?: string }> }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {items.map((f) => (
        <div key={f.title} className="bg-surface p-5">
          {f.icon && <f.icon className="mb-3 size-5 text-primary" />}
          <h3 className="font-medium">{f.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl space-y-4 text-base leading-7 text-foreground/90 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">{children}</div>;
}
