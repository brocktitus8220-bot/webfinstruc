import type { Metadata } from "next";
import { TransactionDetail } from "@/features/transactions/transaction-detail";

export const metadata: Metadata = { title: "Income detail" };

export default async function IncomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionDetail id={id} kind="income" />;
}
