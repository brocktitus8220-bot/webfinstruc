import type { Metadata } from "next";
import { BarChart3, Calculator, Command, FileText, Gauge, Layers, PiggyBank, Table2, Wallet } from "lucide-react";
import { PRODUCT_NAME } from "@repo/core/config";
import { FeatureGrid, PageHero, Section } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Features" };

export default function FeaturesPage() {
  return (
    <>
      <PageHero eyebrow="Features" title="A command center for irregular income" description={`${PRODUCT_NAME} brings cash, income, taxes, and investments into one workspace.`} />
      <Section title="Know where you stand">
        <FeatureGrid items={[
          { title: "Runway", body: "Cash divided by average spending, with a clear healthy, watch, or low signal.", icon: Gauge },
          { title: "Baseline vs. average", body: "See the gap between a slow month and a typical one.", icon: Wallet },
          { title: "Forecast", body: "Conservative and typical cash projections for the next six months.", icon: BarChart3 },
        ]} />
      </Section>
      <Section title="Stay ahead of taxes and savings" className="pt-0">
        <FeatureGrid items={[
          { title: "Allocation rules", body: "Split each payment by percentage, down to the cent.", icon: PiggyBank },
          { title: "Quarterly estimates", body: "Projected payments and due dates from this year's actual income.", icon: Calculator },
          { title: "Invoices", body: "Log what clients owe you so expected income is part of the plan.", icon: FileText },
        ]} />
      </Section>
      <Section title="Fast for people who live in it" className="pt-0">
        <FeatureGrid items={[
          { title: "Workspaces", body: "Business, personal, or all combined, one click away.", icon: Layers },
          { title: "Saved views", body: "Sort, filter, and save table views for the questions you ask often.", icon: Table2 },
          { title: "Keyboard first", body: "Command palette and go-to shortcuts for every page.", icon: Command },
        ]} />
      </Section>
    </>
  );
}
