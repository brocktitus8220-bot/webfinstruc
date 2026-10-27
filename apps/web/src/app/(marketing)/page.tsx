import Link from "next/link";
import { ArrowRight, Calculator, Gauge, Layers, PiggyBank, ShieldCheck, Wallet } from "lucide-react";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@repo/core/config";
import { FeatureGrid, PageHero, Section } from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { title: "Runway at a glance", body: "Know how many months your cash covers, updated as money moves.", icon: Gauge },
  { title: "Baseline income", body: "Plan fixed costs around your lowest reliable month, not a hopeful average.", icon: Wallet },
  { title: "Automatic allocation", body: "Split every payment into taxes, operating, owner pay, and savings.", icon: PiggyBank },
  { title: "Quarterly tax estimates", body: "See what to pay and when, with safe harbor built in.", icon: Calculator },
  { title: "Business and personal", body: "Switch between workspaces or see everything combined.", icon: Layers },
  { title: "Private by default", body: "Read-only connections. Your data is never sold.", icon: ShieldCheck },
];

export default function HomePage() {
  return (
    <>
      <PageHero
        eyebrow="For freelancers, founders, and creators"
        title={PRODUCT_TAGLINE}
        description={`${PRODUCT_NAME} turns uneven months into a plan: what you can spend, what to set aside for taxes, and how long your cash will last.`}
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/signup">Get started <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/features">See how it works</Link></Button>
        </div>
      </PageHero>
      <Section title="Built for income that does not arrive on a schedule" description="Everything in one calm, dense view.">
        <FeatureGrid items={FEATURES} />
      </Section>
    </>
  );
}
