import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/ui/url-tabs";
import { AskTab } from "@/features/overview/ask-tab";
import { ForecastTab } from "@/features/overview/forecast-tab";
import { TodayTab } from "@/features/overview/today-tab";
import { OVERVIEW_TABS, resolveTab } from "@/lib/tabs";

export const metadata: Metadata = { title: "Overview" };

const LABELS = { today: "Today", forecast: "Forecast", ask: "Ask" } as const;

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const tab = resolveTab(OVERVIEW_TABS, (await searchParams).tab);
  return (
    <div className="space-y-4">
      <PageHeader title="Overview" description="Your command center for cash, income, and what is coming next." />
      <UrlTabs basePath="/app/overview" tabs={OVERVIEW_TABS} active={tab} labels={LABELS} />
      {tab === "today" && <TodayTab />}
      {tab === "forecast" && <ForecastTab />}
      {tab === "ask" && <AskTab />}
    </div>
  );
}
