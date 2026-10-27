import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_URL } from "@repo/core/config";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCT_URL),
  title: { default: `${PRODUCT_NAME}: ${PRODUCT_TAGLINE}`, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
  applicationName: PRODUCT_NAME,
  openGraph: { siteName: PRODUCT_NAME, title: PRODUCT_NAME, description: PRODUCT_TAGLINE },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1015" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </AuthProvider>
  );
}
