import type { Metadata } from "next";
import { PlaidOAuthResume } from "@/features/connections/plaid-oauth-resume";

export const metadata: Metadata = { title: "Connecting your bank" };

/** Banks that use OAuth send the user back here. Set PLAID_REDIRECT_URI to this page's URL. */
export default function PlaidOAuthPage() {
  return <PlaidOAuthResume />;
}
