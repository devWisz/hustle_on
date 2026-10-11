# frontend

The web application, including the admin console at `/admin`.
Next.js 15 App Router, React 19, Tailwind v4, GSAP 3, TypeScript in strict mode.

## Layout

```
src/app                      routes; server components unless a page needs interactivity
src/app/admin                overview, review desk, reports, library, front page,
                             members, ledger, notes, audit trail
src/components/ui            primitives (button, card, form, badge, avatar, layout) and icons
src/components/layout        header, footer, command palette, shortcuts, toasts, theme
src/components/motion        GSAP wrappers: reveal, split headings, count-up, magnetic, scroll-scale
src/components/timelapse     card, feed, grid, hero showcase, player, session inspector
src/components/watch         donate panel, discussion, share card, up next, report button
src/components/account       login, guest actions and notice, onboarding, upload,
                             settings, submissions, saved list
src/components/admin         admin nav, data table, activity chart, review desk,
                             reports inbox, notes moderation, library, front page,
                             members, ledger, audit log
src/lib/api                  browser client and server fetcher
src/lib/data.ts              every page's server-side data, read straight from the API
src/middleware.ts            security headers and cache rules
```

## Data

Every page reads through `lib/data.ts`. There is no fallback content: when the API
is unreachable, or returns nothing, a surface renders an intentional empty state
or `null` rather than invented records. When the API comes back, an open page
notices and reloads its data.

## Motion

All animation goes through `components/motion`, which registers GSAP,
ScrollTrigger, SplitText and Flip once. Every animation is set up inside
`gsap.matchMedia`, so reduced-motion visitors get the finished state. Content
hidden before an entrance is gated behind the `.js` class, which is removed if
the page never hydrates.

## Rules

**Server components by default.** `"use client"` only where there is state, an
event handler or an animation.

**No emoji, no glow.** Icons are inline SVG from `components/ui/icons.tsx`.
Depth comes from borders, neutral shadows and motion.

**Tokens, not values.** Colour, radius and shadow come from CSS custom
properties in `app/globals.css`.

**Middleware authorises nothing.** Every real check runs in the API against the
session record.

## Commands

```bash
npm run dev        # :3001
npm run build
npm run typecheck
npm run lint
```
