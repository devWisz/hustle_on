# frontend

The public application. Next.js 15 App Router, React 19, Tailwind v4,
TypeScript in strict mode.

## Layout

```
src/app          routes; server components unless a page needs interactivity
src/components   ui.tsx primitives, icons.tsx, feature components
src/lib          api client, types, formatting, wallet access
src/middleware   redirect for authenticated routes
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
an event handler: forms, the sponsor panel, comments, the mobile menu.

**No emoji.** Icons come from `components/icons.tsx` as inline SVG. See
`docs/design-system.md`.

**Tokens, not values.** Colour, radius and shadow come from CSS custom
properties. A component containing a hex value is a bug.

**Filters are GET forms.** Every filtered view has a shareable URL and works
without JavaScript.

**User text is text.** React escapes it; nothing renders user-supplied HTML.

## Commands

```bash
npm run dev        # :3000
npm run build
npm run typecheck
npm run lint
```
