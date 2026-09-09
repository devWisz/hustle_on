# frontend

The web application, including the role-gated review queue at `/admin`.
Next.js 15 App Router, React 19, Tailwind v4, TypeScript in strict mode.

## Layout

```
src/app           routes; server components unless a page needs interactivity
src/components    ui.tsx primitives, icons.tsx, feature components
src/lib           api client, types, formatting, wallet access
src/middleware.ts security headers, and a redirect for signed-out visitors
```

## How data is fetched

`apiServer` runs in server components. It forwards the visitor's cookies, so a
page renders exactly what that visitor may see, and it returns `null` instead
of throwing — a page degrades to an empty state rather than an error screen
when the API hiccups.

`api` runs in the browser. It sends the session cookie and, for anything that
changes state, the CSRF token read from its readable companion cookie.

## Rules

**Server components by default.** `"use client"` only where there is state or
an event handler: the forms, the donate panel, the review queue, the player.

**No emoji.** Icons come from `components/icons.tsx` as inline SVG. See
`docs/design-system.md`.

**Tokens, not values.** Colour, radius and shadow come from CSS custom
properties. A component containing a hex value is a bug.

**User text is text.** React escapes it; nothing renders user-supplied HTML.
Outbound links to user-supplied URLs carry `rel="noopener noreferrer nofollow"`,
and the URLs themselves are pinned to GitHub and X by the API.

**Middleware authorises nothing.** It redirects on the presence of a session
cookie, which is only a hint. Every real check runs in the API against the
session record.

## Commands

```bash
npm run dev        # :3000
npm run build
npm run typecheck
npm run lint
```
