import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/layout/cookie-settings-button";
import { LegalPage } from "@/components/layout/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Every cookie and stored preference Hustle On uses, what it is for and how long it lasts.",
};

const sections = [
  {
    title: "What we use",
    body: "Hustle On uses a handful of essential cookies to keep you signed in and to protect your account, and, only if you allow it, browser storage that remembers a few preferences on this device. There are no advertising, analytics or cross-site tracking cookies, and none are set by third parties.",
  },
  {
    title: "hustleon_session (essential)",
    body: "Keeps you signed in. It holds a random token whose hash is stored on our server, and it is marked HttpOnly, so no script on the page can read it. It lasts up to thirty days and is deleted when you sign out.",
  },
  {
    title: "hustleon_session_csrf (essential)",
    body: "Protects every change you make, such as uploading, posting a note or sponsoring, against cross-site request forgery. The page reads it and sends it back with each request so the server can confirm the request came from Hustle On. It lasts as long as your session.",
  },
  {
    title: "hustleon_guest (essential until you sign in)",
    body: "Only set if you choose Continue as guest on the sign-in page. It tells the interface to stop asking you to sign in and to explain what an account is for when you reach something that needs one. It grants nothing: uploading, commenting, saving and the admin console are all still refused without a session, and the API never sees this cookie. It lasts twelve hours, and signing in or choosing essential cookies only removes it.",
  },
  {
    title: "hustleon_consent (essential)",
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
