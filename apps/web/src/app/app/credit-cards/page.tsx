import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/ui/url-tabs";
import { CardsSetupTab } from "@/features/credit-cards/cards-tab";
import { CardsOptimizeTab } from "@/features/credit-cards/optimize-tab";
import { CardsOverviewTab } from "@/features/credit-cards/overview-tab";
import { CREDIT_CARD_TABS, resolveTab } from "@/lib/tabs";

export const metadata: Metadata = { title: "Credit Cards" };

const LABELS = { overview: "Overview", optimize: "Optimize", cards: "Cards and import" } as const;

export default async function CreditCardsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const tab = resolveTab(CREDIT_CARD_TABS, (await searchParams).tab);
  return (
    <div className="space-y-4">
      <PageHeader title="Credit Cards" description="Balances, utilization, and rewards, with the best card for each kind of spending." />
      <UrlTabs basePath="/app/credit-cards" tabs={CREDIT_CARD_TABS} active={tab} labels={LABELS} />
      {tab === "overview" && <CardsOverviewTab />}
      {tab === "optimize" && <CardsOptimizeTab />}
      {tab === "cards" && <CardsSetupTab />}
    </div>
  );
}
