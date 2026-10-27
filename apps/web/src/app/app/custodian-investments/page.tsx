import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { HoldingsView } from "@/features/investments/holdings-view";

export const metadata: Metadata = { title: "Custodian Investments" };

export default function CustodianInvestmentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Custodian Investments" description="Accounts held by a custodian, such as advisor-managed portfolios and retirement plans." />
      <HoldingsView custodial />
    </div>
  );
}
