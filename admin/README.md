# admin

The moderation and operations console, a separate Next.js application so its
code, its routes and its Content-Security-Policy never share a bundle with the
public site.

Runs on port 3001. It uses the same session cookie as the public app, and every
route it calls is behind `requireRole("admin", "moderator")` in the API — this
app renders a console, it does not grant one.

## What it does

- **Overview** — live platform figures read from the database.
- **Reports** — the moderation queue, oldest first, with the actions a
  moderator may take.

## Role boundaries

Moderators can act on content: hide it, remove it, warn its author. Only admins
can suspend or ban an account, and the API enforces that independently of what
this interface offers. Every resolution is written to `audit_log` with the
acting account, the subject and the action.

## Deployment

Deploy behind whatever access control your organisation already uses — a VPN,
an identity-aware proxy, or an IP allow list. The role check in the API is the
authorisation boundary; network restriction is defence in depth on top of it.
