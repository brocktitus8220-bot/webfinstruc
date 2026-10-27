import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/marketing/sections";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RESOURCES } from "@/lib/resources";

export const metadata: Metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <>
      <PageHero eyebrow="Resources" title="Guides for irregular income" description="Short, practical reads on planning, taxes, and cash." />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          {RESOURCES.map((r) => (
            <Link key={r.slug} href={`/resources/${r.slug}`} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-primary/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="primary">{r.category}</Badge> {r.readMinutes} min read
                </div>
                <h3 className="mt-3 font-medium group-hover:text-primary">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
