import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TransactionsView } from "@/features/transactions/transactions-view";

export const metadata: Metadata = { title: "Income" };

export default function IncomePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Income" description="Every payment in, with baseline and average to plan around." />
      <TransactionsView kind="income" />
    </div>
  );
}
