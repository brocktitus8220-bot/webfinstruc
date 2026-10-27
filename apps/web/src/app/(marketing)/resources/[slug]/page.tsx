import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Prose, Section } from "@/components/marketing/sections";
import { Badge } from "@/components/ui/badge";
import { RESOURCES } from "@/lib/resources";

export function generateStaticParams() {
  return RESOURCES.map((r) => ({ slug: r.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = RESOURCES.find((x) => x.slug === slug);
  return r ? { title: r.title, description: r.summary } : {};
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = RESOURCES.find((x) => x.slug === slug);
  if (!r) notFound();
  return (
    <Section>
      <Link href="/resources" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All resources</Link>
      <article className="mt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="primary">{r.category}</Badge> {r.readMinutes} min read</div>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">{r.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{r.summary}</p>
        <div className="mt-8"><Prose>{r.body.map((p) => <p key={p}>{p}</p>)}</Prose></div>
      </article>
    </Section>
  );
}
