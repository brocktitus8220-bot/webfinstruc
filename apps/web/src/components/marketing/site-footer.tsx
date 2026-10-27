import Link from "next/link";
import { PRODUCT_NAME, PRODUCT_SUPPORT_EMAIL, PRODUCT_TAGLINE } from "@repo/core/config";
import { Logo } from "@/components/logo";

const COLUMNS = [
  { title: "Product", links: [["Features", "/features"], ["Pricing", "/pricing"], ["Security", "/security"]] },
  { title: "Learn", links: [["Resources", "/resources"], ["About", "/about"]] },
  { title: "Legal", links: [["Privacy", "/legal/privacy"], ["Terms", "/legal/terms"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{PRODUCT_TAGLINE}</p>
          <a href={`mailto:${PRODUCT_SUPPORT_EMAIL}`} className="text-xs text-muted-foreground hover:text-foreground">{PRODUCT_SUPPORT_EMAIL}</a>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h4 className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{c.title}</h4>
            <ul className="space-y-1.5">
              {c.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-sm text-muted-foreground hover:text-foreground">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {PRODUCT_NAME}. Not a bank. Not tax advice.
        </div>
      </div>
    </footer>
  );
}
