import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/ui/url-tabs";
import { AssumptionsTab, EstimatesTab, SafeHarborTab } from "@/features/tax/tax-views";
import { resolveTab, TAX_TABS } from "@/lib/tabs";

export const metadata: Metadata = { title: "Tax Projection" };

const LABELS = { estimates: "Estimates", assumptions: "Assumptions", "safe-harbor": "Safe harbor" } as const;

export default async function TaxProjectionPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const tab = resolveTab(TAX_TABS, (await searchParams).tab);
  return (
    <div className="space-y-4">
      <PageHeader title="Tax Projection" description="Quarterly estimates based on how this year is actually going." />
      <UrlTabs basePath="/app/tax-projection" tabs={TAX_TABS} active={tab} labels={LABELS} />
      {tab === "estimates" && <EstimatesTab />}
      {tab === "assumptions" && <AssumptionsTab />}
      {tab === "safe-harbor" && <SafeHarborTab />}
    </div>
  );
}
