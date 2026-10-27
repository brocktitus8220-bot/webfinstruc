import Link from "next/link";
import { PRODUCT_TAGLINE } from "@repo/core/config";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r bg-gradient-to-br from-accent/60 to-background p-10 lg:flex">
        <Link href="/"><Logo /></Link>
        <p className="max-w-sm text-2xl font-semibold tracking-tight">{PRODUCT_TAGLINE}</p>
        <span />
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8 lg:hidden"><Logo /></Link>
        {children}
      </div>
    </div>
  );
}
