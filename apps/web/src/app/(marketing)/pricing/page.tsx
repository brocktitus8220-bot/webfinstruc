import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  { name: "Starter", price: "$0", cadence: "during preview", features: ["One business and one personal workspace", "Runway and baseline income", "Allocation rules"], cta: "Start free" },
  { name: "Pro", price: "$12", cadence: "per month, placeholder", features: ["Everything in Starter", "Quarterly tax projection", "Saved views and exports", "Unlimited accounts"], cta: "Join the waitlist", featured: true },
  { name: "Advisor", price: "Custom", cadence: "for professionals", features: ["Client workspaces", "Custodian data", "Shared views"], cta: "Contact us" },
];

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple pricing" description="Prices are placeholders while the product is in preview." />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={cn("flex flex-col p-6", p.featured && "border-primary ring-1 ring-primary/30")}>
              <h3 className="font-medium">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.cadence}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 text-primary" /> {f}</li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={p.featured ? "default" : "outline"}><Link href="/signup">{p.cta}</Link></Button>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
