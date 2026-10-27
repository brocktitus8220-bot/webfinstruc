import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsSection } from "@/features/settings/sections";
import { SETTINGS_NAV, type SettingsSlug } from "@/lib/nav";

export function generateStaticParams() {
  return SETTINGS_NAV.map((s) => ({ section: s.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const item = SETTINGS_NAV.find((s) => s.slug === section);
  return { title: item ? `Settings: ${item.label}` : "Settings" };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SETTINGS_NAV.some((s) => s.slug === section)) notFound();
  return <SettingsSection slug={section as SettingsSlug} />;
}
