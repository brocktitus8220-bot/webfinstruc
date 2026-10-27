import type { Metadata } from "next";
import { HoldingDetail } from "@/features/investments/holding-detail";

export const metadata: Metadata = { title: "Holding" };

export default async function HoldingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HoldingDetail id={id} />;
}
