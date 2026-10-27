import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { HoldingsView } from "@/features/investments/holdings-view";

export const metadata: Metadata = { title: "Investments" };

export default function InvestmentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Investments" description="Accounts you manage yourself." />
      <HoldingsView custodial={false} />
    </div>
  );
}
