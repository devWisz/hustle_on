# Documentation

Start with whichever question you actually have.

| Document | Answers |
| --- | --- |
| [getting-started.md](getting-started.md) | How do I run this locally? |
| [workflow.md](workflow.md) | What happens between an upload and a donation? |
| [auth.md](auth.md) | How does signing in and wallet proof work? |
| [architecture.md](architecture.md) | What are the pieces and why these ones? |
| [database.md](database.md) | What does the schema look like, and why? |
| [api.md](api.md) | What endpoints exist? |
| [payments.md](payments.md) | How is a donation verified? |
| [security.md](security.md) | What is defended, and how? |
| [design-system.md](design-system.md) | What are the interface rules? |
| [guest-preview.md](guest-preview.md) | What can somebody see without an account? |
| [deployment.md](deployment.md) | How does this go to production? |
| [contributing.md](contributing.md) | How do I change it? |

Decisions that were hard to make, and the reasoning at the time, are in
[adr/](adr/). They are not updated when the code changes — they record what was
true when the decision was taken.

If you are reading one file first, read [workflow.md](workflow.md). Everything
else in the product exists to serve the path it describes.
