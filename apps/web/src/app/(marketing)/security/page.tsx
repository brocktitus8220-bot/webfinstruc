import type { Metadata } from "next";
import { EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { PRODUCT_NAME } from "@repo/core/config";
import { FeatureGrid, PageHero, Section } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <>
      <PageHero eyebrow="Security" title="Your money data, handled carefully" description={`How ${PRODUCT_NAME} protects your accounts and information. Details will be finalized before launch.`} />
      <Section>
        <FeatureGrid items={[
          { title: "Read-only connections", body: "We can see balances and transactions. We can never move money.", icon: EyeOff },
          { title: "Encryption", body: "Data is encrypted in transit and at rest.", icon: Lock },
          { title: "Modern sign-in", body: "Passwordless and multi-factor sign-in through a dedicated identity provider.", icon: KeyRound },
          { title: "No selling data", body: "Your data is never sold or used for advertising.", icon: ShieldCheck },
        ]} />
      </Section>
    </>
  );
}
