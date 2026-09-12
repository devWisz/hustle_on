# Guest preview

A visitor can look around the whole product before deciding whether to make an
account. The feed, a watch page, a creator profile, the creator dashboard, the
submission form and the account settings all open without signing in, filled in
with sample records wherever there is nothing real to show.

The reason is narrow. Everything interesting about this product — that a person
reads every submission, that a rejection comes back with a reason, that the
money never touches us — is visible on screens that used to sit behind a
sign-in form. Asking somebody to hand over an email address to find out what
the thing does is the wrong order.

## What it is, and what it is not

**It is a rendering preference.** The cookie unlocks nothing on the API. Every
endpoint still sees an unauthenticated request and still answers one. All the
cookie does is tell three pages to render their sample state instead of
redirecting to `/login`.

That is the whole safety argument: forging the cookie buys exactly the sample
data the button hands out for free. There is no path from a guest preview to
anybody's real record, because the preview never asks the API for one.

**It is not an account.** Nothing can be written. A submission, a profile
change, a wallet verification and a donation all need an account, because each
of them has to belong to somebody a reviewer can write back to.

## The pieces

| File | What it holds |
|---|---|
| `lib/guest.ts` | The cookie name, the previewable routes, `safeNext` |
| `lib/guest-server.ts` | `isGuestPreview()` — reads the request's cookies |
| `lib/guest-actions.ts` | The two server actions that set and clear the cookie |
| `lib/sample.ts` | Every invented record in the product |
| `components/guest.tsx` | The banner, the enter and exit buttons, `GuestGate`, `SampleTag`, `SampleNote` |

Entering and leaving are server actions on a form, not links. A GET that changes
state gets fired by a prefetch, a link preview or a crawler, and a visitor would
find themselves in preview mode without having asked. Being form submissions
also means both still work with no JavaScript.

## Routes

`middleware.ts` lets a guest render `/dashboard`, `/settings` and `/upload`.
`/admin` is deliberately not on that list: it is the moderation surface, and
previewing it would mean showing a stranger a queue of real submissions or
inventing a fake one for them to act on. The review story is told on the guest
dashboard instead, by a sample submission that was declined with a reason.

Each of those pages asks the API for the real thing first and falls back to the
sample only when the answer is "nobody is signed in".

## The rules the sample data follows

1. **Real data always wins.** Sample records appear only where the live answer
   was empty. A signed-in session never sees one.
2. **Everything invented is labelled.** Cards carry a `SampleTag`, screens carry
   a `SampleNote`, and the banner under the header says so on every page.
3. **Sample slugs are prefixed `sample-`.** A preview URL can never collide with
   a real one, and a sample page returns `robots: noindex` so it cannot be
   indexed as somebody's genuine work.
4. **Nothing is simulated that would mislead.** The sample watch page shows a
   still frame and says there is no video behind it, rather than wiring up a
   player with a dead source. The donate panel explains what it would do and
   stays disabled.
5. **Forms keep working, and say what they would do.** The submission form
   accepts input and submits nothing, and the button says why rather than
   pretending.

The cookie lasts twelve hours — long enough to finish looking around, short
enough not to linger.
