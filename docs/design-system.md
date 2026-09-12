# Design system

The interface is typography-led and monochrome with a single accent. It has no
emoji anywhere — an emoji renders differently on every platform, carries no
accessible name, and reads as decoration next to the work people are publishing
here. Icons are inline SVG in `components/icons.tsx`.

Do not introduce a new colour, radius or shadow without adding it here first.

## Tokens

Every colour in the product is declared in `app/globals.css`. Components
reference the token, never a raw value, so dark mode is a variable swap and
nothing downstream needs a second set of classes.

| Token | Role |
| --- | --- |
| `--bg` | Page ground |
| `--surface` | Cards, inputs |
| `--surface-raised` | Hover, skeletons, insets |
| `--border` / `--border-strong` | Default and hover borders |
| `--fg` / `--fg-muted` / `--fg-subtle` | Primary, secondary, tertiary text |
| `--accent` / `--accent-hover` / `--accent-fg` / `--accent-soft` | The one accent |
| `--danger` / `--danger-soft` | Rejections, destructive actions |

Three radii (`control` 8px, `card` 12px, `panel` 16px) and three shadows
(`card`, `raised`, `lifted`). That is the whole vocabulary.

There is no glow token, and adding one back would be a regression. Depth is
carried by a neutral shadow, a border and movement. A coloured halo behind an
element implies a light source the page does not have; it reads as noise at
small sizes and it is the first thing to look cheap on a poor display.

**Theme.** Light is defined on bare `:root`. Dark is redefined under
`@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`,
and again under `:root[data-theme="dark"]` so an explicit choice wins in both
directions. A small script in `layout.tsx` applies the stored preference before
first paint, so the page does not flash the wrong theme and then swap.

## Type

Inter, with `font-feature-settings` for the alternate glyphs. Headings tighten
tracking to `-0.021em` and use `text-wrap: balance`; body copy stays at natural
spacing with `text-wrap: pretty`, because long write-ups are meant to be read.

Sizes are set explicitly (`text-[15px]`, `text-[13px]`) rather than by scale
name — the steps this interface needs are narrower than Tailwind's defaults.

All numbers use `tabular-nums`. A donation total that shifts width as it
animates is worse than no animation.

Prose caps at `68ch`. The "what I did" section on a watch page is the longest
text in the product and gets the leading to match (`leading-[1.7]`).

## Primitives

Everything visual is assembled from `components/ui.tsx`, so a change to a radius
or a focus ring happens once: `Button`, `ButtonLink`, `Card`, `Input`,
`Textarea`, `Field`, `Badge`, `Avatar`, `Stat`, `SectionHeading`, `EmptyState`,
`Container`, `SpinnerCard`.

`Field` is the one to reach for in forms. It binds a real `<label>` by id, wires
the hint through `aria-describedby`, and announces errors with `role="alert"`.
Forms are where accessibility lapses cost people the most, so the correct wiring
is the path of least effort.

`Container` has three widths — `narrow` (2xl), `default` (5xl), `wide` (6xl).
Every route uses one; no page sets its own max-width.

## Rules

**One accent.** It marks the primary action and the published state. If two
things on a screen are accented, one of them is wrong.

**Status is a word, not a colour.** `StatusBadge` says "Waiting for review", not
a coloured dot. Colour reinforces; it never carries the meaning alone.

**Empty states say what to do.** `EmptyState` takes an action for a reason. "No
submissions yet" with an upload button beats an empty grid.

**Never fabricate content that is not labelled as such.** Real data and
invented data must never be indistinguishable. Outside guest preview the rule is
absolute: no placeholder avatars of invented people, no sample metrics, no
simulated player — an empty state is honest, silent fake data is not.

Guest preview is the single exception, and it is an exception about labelling
rather than about honesty. Everything it renders comes from `lib/sample.ts`,
every surface built from it carries a `SampleTag` or a `SampleNote`, real data
always wins when there is any, and sample slugs are prefixed `sample-` so a
preview URL can never collide with a real one. A sample page also returns
`robots: noindex`. See [guest-preview.md](guest-preview.md).

**Focus is always visible.** One treatment, defined once in `globals.css`.
Keyboard users must never have to guess where they are.

**Motion is optional.** `prefers-reduced-motion` collapses every animation to
0.01ms in `globals.css`. Nothing should depend on movement to be understood.

**Content is never hidden by an animation that might not run.** Scroll-reveal
starts elements at `opacity: 0`, which is only safe because the hidden state is
scoped to `.js` — a class the boot script in `layout.tsx` sets before first
paint. No script, no class, no hiding. The same script lifts the class again if
`data-hydrated` has not appeared four seconds after load, so a bundle that fails
to load degrades to a still page rather than a blank one.

## Composition utilities

Three utilities in `globals.css` do most of the work of making a section read as
composed rather than as a stack of boxes.

| Utility | What it is for |
|---|---|
| `text-eyebrow` | The small tracked label naming a band above its heading |
| `eyebrow-rule` | An eyebrow with a rule running out from it, so small caps do not read as a stray line |
| `figure-rail` | A row of figures separated by hairlines instead of boxed in cards; the rule and the cell padding both move when the grid reflows from four columns to two |

**Prefer a divider to a boxed card** when the things in a row are one reading of
the same subject. Three steps in an order are a sequence, not three unrelated
facts, and a row of identical boxes is the one layout that cannot say so.

**A grid gap is not a divider.** `gap-px` over a coloured ground shows through
as a grey slab for as long as a cell is still transparent, which is the entire
duration of a staggered reveal. Use `divide-x` / `divide-y` on a surface.

**Cards with no image get artwork, not a grey rectangle.** `ThumbArtwork`
(`components/thumb.tsx`) draws a ruled field whose angle and density are hashed
from the slug, with the work's initials set large and quiet over it. It is
deterministic, so the same timelapse looks the same on every visit, and it is
`aria-hidden`, because the card's own title carries the meaning.

## Motion

One easing curve, `--ease-out-quint`, for everything. Durations vary between
120ms (a press) and 600ms (a reveal); the curve does not, so the whole product
has a single sense of weight.

| Utility | Where it belongs |
|---|---|
| `animate-fade-in-up` + `delay-1…6` | A hero or header sequence, above the fold |
| `stagger-children` | A grid or list whose items arrive together |
| `Reveal` (`[data-reveal]`) | Anything below the fold; one shared observer for the page |
| `CountUp` | A figure that is worth noticing — never a figure that is still loading |
| `card-hover` | Cards that link somewhere |
| `press` | Every button; already in `buttonClass` |
| `nudge-icon` | An arrow inside a `group` that leads onward |

Hover effects are wrapped in `@media (hover: hover)`. A phone has no hover, and
a lift that fires on touch fights the scroll.

**Wide content scrolls itself.** Tables, code and diagrams go in an
`overflow-x: auto` container. The page body never scrolls horizontally.

**Every layout is built up from 320px.** Type is fluid (`text-display`,
`text-title`, `text-lede` clamp between a phone and a desktop), rows stack
before they crush, and a row of chips scrolls rather than wraps. Text inputs are
16px below the `sm` breakpoint: anything smaller makes iOS Safari zoom the whole
page the moment the field takes focus.

## Voice

Plain sentences. Say what happened and what to do next.

- "Waiting for review" — not "PENDING_REVIEW".
- "You cancelled the transaction." — not "Error: user rejected request".
- "This creator has not set up a wallet to receive donations yet." — not
  "payout_address is null".

Error messages are for the person reading them. The internal cause goes to the
log, with a request id that ties the two together.
