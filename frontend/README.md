# frontend

The web application, including the admin console at `/admin`.
Next.js 15 App Router, React 19, Tailwind v4, GSAP 3, TypeScript in strict mode.

## Layout

```
src/app                      routes; server components unless a page needs interactivity
src/app/admin                overview, review desk, library, members, ledger, audit trail
src/components/ui            primitives (button, card, form, badge, avatar, layout) and icons
src/components/layout        header, footer, command palette, shortcuts, toasts, theme
src/components/motion        GSAP wrappers: reveal, split headings, count-up, marquee, magnetic
src/components/timelapse     card, feed, hero showcase, player, preview
src/components/watch         donate panel, discussion, share card, up next
src/components/account       login, upload, settings, submissions, saved list
src/components/admin         admin nav, data table, activity chart, review desk, tables
src/components/demo          demo banner and demo labels
src/lib/api                  browser client and server fetcher
src/lib/demo                 demo content, admin demo data, demo cookie and actions
src/lib/data.ts              every page's data, with the demo fallback
src/middleware.ts            security headers and cache rules
public/demo                  generated demo timelapses (scripts/gen_demo_videos.py)
```

## Demo mode

Every page reads through `lib/data.ts`. When the API cannot be reached, or the
visitor starts the demo from the login page, pages render sample data and the
generated demo videos, labelled as demo throughout. Nothing a demo visitor does
is sent anywhere. When the API comes back, an open page notices and reloads its
data.

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
