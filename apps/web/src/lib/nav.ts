import {

  Building2,
  Calculator,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Second key of the `g` then key go-to shortcut. */
  shortcut?: string;
}

export const APP_NAV: NavItem[] = [
  { label: "Overview", href: "/app/overview", icon: LayoutDashboard, shortcut: "o" },
  { label: "Income", href: "/app/income", icon: Wallet, shortcut: "i" },
  { label: "Expenses", href: "/app/expenses", icon: Receipt, shortcut: "e" },
  { label: "Investments", href: "/app/investments", icon: TrendingUp, shortcut: "v" },
  { label: "Custodian Investments", href: "/app/custodian-investments", icon: Building2 },
  { label: "Tax Projection", href: "/app/tax-projection", icon: Calculator, shortcut: "t" },
  { label: "Settings", href: "/app/settings/profile", icon: Settings },
];

export const SETTINGS_NAV = [
  { slug: "profile", label: "Profile" },
  { slug: "accounts", label: "Accounts" },
  { slug: "allocation", label: "Allocation" },
  { slug: "categories", label: "Categories" },
  { slug: "tax", label: "Tax" },
  { slug: "ai-privacy", label: "AI and privacy" },
  { slug: "notifications", label: "Notifications" },
  { slug: "billing", label: "Billing" },
  { slug: "data", label: "Data" },
] as const;
export type SettingsSlug = (typeof SETTINGS_NAV)[number]["slug"];

export const MARKETING_NAV = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/security" },
  { label: "Resources", href: "/resources" },
  { label: "About", href: "/about" },
];

