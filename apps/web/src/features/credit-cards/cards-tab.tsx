"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreditCards } from "@/lib/queries";
import { ConnectBankButton } from "../connections/connect-bank-button";
import { AppleCardImport } from "./apple-card-import";
import { CardEditor } from "./card-editor";

export function CardsSetupTab() {
  const cards = useCreditCards();
  if (cards.isLoading || !cards.data) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Set each card's limit, due date, and rewards so the optimizer can compare them. Card terms change, so check them against your issuer.
        </p>
        <ConnectBankButton label="Connect a card" variant="outline" />
      </div>
      {cards.data.map((card) => <CardEditor key={`${card.accountId}:${JSON.stringify(card.profile)}`} card={card} />)}
      <AppleCardImport cards={cards.data} />
    </div>
  );
}
