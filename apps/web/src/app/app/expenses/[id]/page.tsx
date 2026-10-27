import type { Metadata } from "next";
import { TransactionDetail } from "@/features/transactions/transaction-detail";

export const metadata: Metadata = { title: "Expense detail" };

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionDetail id={id} kind="expense" />;
}
