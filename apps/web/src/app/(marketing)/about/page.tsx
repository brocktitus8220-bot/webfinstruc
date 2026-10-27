import type { Metadata } from "next";
import { PRODUCT_NAME } from "@repo/core/config";
import { PageHero, Prose, Section } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Money tools for people without a paycheck" />
      <Section>
        <Prose>
          <p>Most personal finance software assumes the same deposit lands every two weeks. Millions of people do not work that way.</p>
          <p>{PRODUCT_NAME} is built for freelancers, founders, and creators whose income arrives in bursts. We focus on the questions that matter when months are uneven: how long will my cash last, what is safe to spend, and what do I owe in taxes.</p>
        </Prose>
      </Section>
    </>
  );
}
