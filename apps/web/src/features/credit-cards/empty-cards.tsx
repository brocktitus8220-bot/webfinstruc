"use client";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConnectBankButton } from "../connections/connect-bank-button";

export function EmptyCards() {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <CreditCard className="size-6 text-muted-foreground" />
      <div>
        <div className="font-medium">No credit cards in this workspace</div>
        <p className="mt-1 text-sm text-muted-foreground">Connect a card through Plaid, or import an Apple Card statement.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <ConnectBankButton label="Connect a card" />
        <Button asChild variant="outline"><Link href="/app/credit-cards?tab=cards#import">Import Apple Card statement</Link></Button>
      </div>
    </Card>
  );
}
