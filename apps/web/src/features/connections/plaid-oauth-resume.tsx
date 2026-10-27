"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { openPlaidLink, takePendingLink } from "@/lib/plaid-link";
import { usePlaidConnect } from "./use-plaid-connect";

/** Finish a Plaid Link session after an OAuth bank redirect. */
export function PlaidOAuthResume() {
  const router = useRouter();
  const { finish } = usePlaidConnect();
  const started = React.useRef(false);
  const [message, setMessage] = React.useState("Finishing your bank connection");

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = takePendingLink();
    if (!pending) {
      setMessage("This connection link has expired. Start again from Settings.");
      return;
    }
    (async () => {
      try {
        const result = await openPlaidLink(pending.linkToken, window.location.href);
        if (result) await finish(pending, result.publicToken, result.metadata.institution?.name);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not connect");
      }
      router.replace(pending.returnTo || "/app/settings/accounts");
    })();
  }, [finish, router]);

  return <Card className="p-8 text-center text-sm text-muted-foreground">{message}</Card>;
}
