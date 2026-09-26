import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getViewer } from "@/lib/data";
import { DemoBanner } from "@/components/demo/demo";
import { ApiWatcher } from "@/components/layout/api-watcher";
import { CommandSearch } from "@/components/layout/command-search";
import { Footer } from "@/components/layout/footer";
import { Header, HeaderFallback } from "@/components/layout/header";
import { ScrollTop } from "@/components/layout/scroll-top";
import { Shortcuts } from "@/components/layout/shortcuts";
import { ToastProvider } from "@/components/layout/toast";
import { HydrationMark } from "@/components/motion/hydration-mark";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){d.setAttribute("data-theme",t);}}catch(e){}d.classList.add("js");setTimeout(function(){if(!d.hasAttribute("data-hydrated")){d.classList.remove("js");}},4000);})();`;

function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return "http://localhost:3001";
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}

const DESCRIPTION =
  "Timelapses of real work, reviewed by a person before they go up and funded in SOL by the people who want to see more of them.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Sardhana — your hustle should be paid off", template: "%s — Sardhana" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Sardhana", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

async function OfflineWatcher() {
  const viewer = await getViewer();
  return viewer.online ? null : <ApiWatcher />;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <HydrationMark />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-inverse-fg"
        >
          Skip to content
        </a>
        <ToastProvider>
          <Suspense fallback={null}>
            <DemoBanner />
          </Suspense>
          <Suspense fallback={<HeaderFallback />}>
            <Header />
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <ScrollTop />
          <Shortcuts />
          <CommandSearch />
          <Suspense fallback={null}>
            <OfflineWatcher />
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
