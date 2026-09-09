import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { HeaderFallback, SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Apply a stored theme before first paint so the page does not flash the
 * system default and then swap.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

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

const DESCRIPTION =
  "Timelapses of real work, reviewed before they go up and funded in SOL by the people who want to see more of them.";

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: "Sardhana — timelapses of real work",
    template: "%s — Sardhana",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Sardhana",
    title: "Sardhana — timelapses of real work",
    description: DESCRIPTION,
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                     focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-4 focus:py-2
                     focus:text-sm focus:shadow-[var(--shadow-raised)]"
        >
          Skip to content
        </a>
        <ToastProvider>
          <Suspense fallback={<HeaderFallback />}>
            <SiteHeader />
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
