import type { Metadata } from "next";
import { PRODUCT_NAME, PRODUCT_SUPPORT_EMAIL } from "@repo/core/config";
import { PageHero, Prose, Section } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" description="Placeholder. This page will be replaced by reviewed legal text before launch." />
      <Section>
        <Prose>
          <h2>What we collect</h2>
          <p>Account details you provide, and financial data from accounts you choose to connect to {PRODUCT_NAME}.</p>
          <h2>How we use it</h2>
          <p>Only to provide the service: balances, projections, and reminders. We do not sell your data.</p>
          <h2>Contact</h2>
          <p>Questions? Email {PRODUCT_SUPPORT_EMAIL}.</p>
        </Prose>
      </Section>
    </>
  );
}
