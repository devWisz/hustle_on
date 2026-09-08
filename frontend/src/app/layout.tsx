import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * A deploy platform can hand an unset variable through as an empty string,
 * which `??` passes along untouched and `new URL("")` then rejects, failing the
 * build while Next collects page data. Blank is treated as absent here, and a
 * bare host is assumed to be https, since that is how these values tend to get
 * pasted into a dashboard. A genuinely malformed value is still left to throw.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return "http://localhost:3000";
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: "HustlerOn — Your hustle should be paid off",
    template: "%s — HustlerOn",
  },
  description:
    "Publish timelapses of the work you actually do. Get sponsored on chain, and get hired on the strength of a public track record.",
  openGraph: {
    type: "website",
    siteName: "HustlerOn",
    title: "HustlerOn — Your hustle should be paid off",
    description:
      "Publish timelapses of the work you actually do. Get sponsored on chain, and get hired on the strength of a public track record.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh flex flex-col antialiased">
        {/* The first stop for a keyboard user on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                     focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-4 focus:py-2
                     focus:text-sm focus:shadow-[var(--shadow-raised)]"
        >
          Skip to content
        </a>
        <ToastProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
