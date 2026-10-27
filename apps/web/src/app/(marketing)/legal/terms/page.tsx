import type { Metadata } from "next";
import { PRODUCT_NAME } from "@repo/core/config";
import { PageHero, Prose, Section } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Service" description="Placeholder. This page will be replaced by reviewed legal text before launch." />
      <Section>
        <Prose>
          <h2>Using the service</h2>
          <p>{PRODUCT_NAME} provides planning tools and estimates. It is not a bank, a broker, or a tax adviser.</p>
          <h2>Your account</h2>
          <p>You are responsible for keeping your sign-in secure and for the accuracy of information you enter.</p>
        </Prose>
      </Section>
    </>
  );
}
