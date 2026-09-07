# Design system

The interface is typography-led and monochrome with one accent. There are no
emoji anywhere in the product — an emoji renders differently on every platform,
carries no accessible name, and reads as decoration next to work people are
asking to be paid for. Icons are inline SVG from `components/icons.tsx`.

## Tokens

Everything is a CSS custom property in `app/globals.css`. Components reference
tokens; no component contains a hex value. Dark mode swaps the variables, so
there is no second set of classes to keep in sync.

| Token | Light | Dark | Use |
| ----- | ----- | ---- | --- |
| `--bg` | `#fbfbfa` | `#0c0c0b` | page ground |
| `--surface` | `#ffffff` | `#141413` | cards, header |
| `--surface-raised` | `#ffffff` | `#1b1b19` | hover, wells, skeletons |
| `--border` | `#e7e5e1` | `#272623` | default hairline |
| `--border-strong` | `#d6d3cd` | `#383733` | hover state of a control |
| `--fg` | `#191815` | `#f4f3f0` | primary text |
| `--fg-muted` | `#5f5b55` | `#a5a097` | body copy, secondary |
| `--fg-subtle` | `#8d887f` | `#77726a` | metadata, captions |
| `--accent` | `#10715a` | `#3fb28c` | primary action, money |
| `--danger` | `#a72f2f` | `#e08585` | destructive, errors |

The accent means one thing: value moving to a person. Sponsorship figures,
primary actions and verified marks use it. It is never decorative.

Dark mode follows the system preference unless the visitor has chosen
explicitly, in which case `data-theme` on `:root` wins in both directions.

## Type

Inter, loaded through `next/font` so there is no layout shift and no request to
a third-party font host at runtime.

| Role | Size | Weight | Tracking |
| ---- | ---- | ------ | -------- |
| Display | 40–56px | 600 | −0.021em |
| Page title | 26–28px | 600 | −0.021em |
| Section | 17–19px | 600 | −0.021em |
| Body | 15px | 400 | normal |
| UI | 13–14px | 400–500 | normal |
| Meta | 12px | 400 | normal |

Headings tighten tracking and use `text-wrap: balance`; body copy stays at
natural spacing with `text-wrap: pretty`. Numbers that sit in columns or update
in place use `tabular-nums`.

## Space and shape

Spacing is Tailwind's 4px scale. Section rhythm is 40px on mobile, 56–80px on
desktop. Three radii only: 8px controls, 12px cards, 16px panels. Two shadows,
both nearly invisible — separation comes from borders, not elevation.

## Layout

`Container` provides the only three widths: `narrow` (2xl) for reading and
forms, `default` (5xl) for lists, `wide` (6xl) for the feed and profiles.

Content-plus-sidebar pages use `grid-cols-[minmax(0,1fr)_320px]` and stack
below `lg`. The sidebar is `sticky top-20` on wide screens, so the sponsorship
panel stays reachable while reading a long description.

Placement follows what a visitor needs next. On a session page the video comes
first, the person second, the sponsor panel is at the top of the sidebar where
the eye lands after the title, and comments sit below the description. On a
profile, the numbers that establish credibility are in the sidebar and the work
itself takes the main column.

## Components

`components/ui.tsx` holds the primitives: `Button`, `ButtonLink`, `Card`,
`Input`, `Textarea`, `Field`, `Badge`, `Avatar`, `Stat`, `SectionHeading`,
`EmptyState`, `Container`. Anything visual is assembled from these.

Buttons have four variants — primary, secondary, ghost, danger — and three
sizes. One primary action per view.

`Field` wires the label, hint and error correctly by construction: a real
`<label>` bound by id, the hint referenced by `aria-describedby`, and errors
announced with `role="alert"`. Forms are where accessibility lapses cost people
the most, so the correct wiring is the path of least effort.

`EmptyState` exists because every list can legitimately be empty, and an empty
list should explain what fills it and offer the action that does.

## Interaction rules

- One visible focus treatment, everywhere: a 2px accent outline with 2px
  offset. Never removed.
- Loading buttons set `aria-busy` and keep their label, so the button does not
  change width mid-action.
- Every state-changing control has an idle, pending, success and failure state.
  Failure says what happened and what was not changed.
- `prefers-reduced-motion` disables animation globally.
- Filters are plain GET forms with shareable URLs, and work without JavaScript.
- Wide content scrolls inside its own container; the page body never scrolls
  horizontally.

## Accessibility

Every page starts with a skip link. Images are `alt=""` when decorative and
described when not. Icons carry a `title` only when they convey meaning alone.
Colour never carries information by itself — a verified link has a check mark
and says "verified" in its accessible name.
