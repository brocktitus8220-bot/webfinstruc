import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TransactionsView } from "@/features/transactions/transactions-view";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" description="Where money goes, business and personal." />
      <TransactionsView kind="expense" />
    </div>
  );
}
