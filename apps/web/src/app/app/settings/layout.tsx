import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/features/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
