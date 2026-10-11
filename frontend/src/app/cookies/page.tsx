import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/layout/cookie-settings-button";
import { LegalPage } from "@/components/layout/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Every cookie and stored preference Sardhana uses, what it is for and how long it lasts.",
};

const sections = [
  {
    title: "What we use",
    body: "Sardhana uses a handful of essential cookies to keep you signed in and to protect your account, and, only if you allow it, browser storage that remembers a few preferences on this device. There are no advertising, analytics or cross-site tracking cookies, and none are set by third parties.",
  },
  {
    title: "sardhana_session (essential)",
    body: "Keeps you signed in. It holds a random token whose hash is stored on our server, and it is marked HttpOnly, so no script on the page can read it. It lasts up to thirty days and is deleted when you sign out.",
  },
  {
    title: "sardhana_session_csrf (essential)",
    body: "Protects every change you make, such as uploading, posting a note or sponsoring, against cross-site request forgery. The page reads it and sends it back with each request so the server can confirm the request came from Sardhana. It lasts as long as your session.",
  },
  {
    title: "sardhana_consent (essential)",
    body: "Remembers the choice you made in the cookie banner, so we do not ask on every visit. It lasts six months.",
  },
  {
    title: "Preferences on this device (optional)",
    body: "With your permission we store your light or dark theme, your recent searches, and, while you are signed out, the sessions you save. These live in your browser's local storage, never leave your device and are deleted as soon as you switch to essential cookies only.",
  },
  {
    title: "Changing your choice",
    body: "You can change your choice at any time from the Cookie settings link at the bottom of every page, or with the button below. Blocking essential cookies in your browser will stop you from signing in.",
  },
] as const;

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Cookie Policy"
      updated="September 27, 2026"
      intro="Exactly what we store in your browser, why, and for how long."
      sections={sections}
      footer={
        <div className="flex flex-col items-start gap-4">
          <CookieSettingsButton />
          <p>
            How we handle your data more broadly is in the{" "}
            <Link href="/privacy" className="font-medium text-fg underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      }
    />
  );
}
