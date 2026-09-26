"""Regenerates database/seeds/dev_seed.sql. Run: python3 scripts/gen_seed.py"""
from pathlib import Path
import random
random.seed(7)
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
def b58(n): return "".join(random.choice(B58) for _ in range(n))
def q(s): return "NULL" if s is None else "'" + s.replace("'", "''") + "'"
def ago(h): return "NULL" if h is None else f"now() - interval '{h} hours'"
def uid(n): return f"00000000-0000-0000-0000-{n:012d}"
def tid(n): return f"00000000-0000-0000-0000-{0xa00+n:012x}"

users = [
 # key, handle, name, role, bio, wallet?
 (1, "reviewer", "Rae Osei", "admin", "Reads every submission before it reaches the feed.", False),
 (2, "mira", "Mira Okonkwo", "member", "Compiler internals, mostly lifetimes. I record the sessions where I am wrong for longer than I am right.", True),
 (3, "theo", "Theo Lindqvist", "member", "Payments infrastructure. Ledgers that balance, or an explanation of why they did not.", True),
 (4, "ana", "Ana Ruiz", "member", "Databases and the queries people regret. Four hours of query plans, condensed.", True),
 (5, "kenji", "Kenji Watanabe", "member", "Firmware and board bring-up. Everything here was recorded at a bench.", True),
 (6, "priya", "Priya Raman", "member", "Interface work on products that are already shipped and already dense.", True),
 (7, "dan", "Dan Whitfield", "member", "Platform migrations, written down so the next person does not have to guess.", True),
 (8, "lena", "Lena Fischer", "member", "Realtime systems and the backpressure nobody plans for.", False),
 (9, "sofia", "Sofia Marin", "member", None, False),
]
wallets = {u[0]: b58(44) for u in users if u[5]}

sessions = [
 # n, user, slug, title, summary, github, x, video, minutes, status, age_hours(submitted), published_hours_ago, views
 (1, 2, "rewriting-the-borrow-checker-pass", "Rewriting the borrow-checker pass",
  "Spent the session replacing the recursive walk in our lifetime inference with an explicit worklist. The recursion was blowing the stack on generated code, and one file in the test corpus nests closures fourteen deep.\n\nThe worklist version is uglier to read and about four times faster. Two tests still fail on early-return borrows; I left them failing rather than papering over them, and the commit says so.",
  "https://github.com/mira/lang/pull/812", None, "borrow-checker", 331, "published", 30, 26, 4820),
 (2, 3, "payment-reconciler-double-refund", "A payment reconciler that survives a double refund",
  "Our reconciler assumed a refund could only happen once per charge. A support agent and a webhook retry did it at the same moment and the ledger went negative.\n\nThis session is the rewrite: every mutation carries an idempotency key derived from the provider event id, and the ledger is append-only with a computed balance instead of a stored one.",
  "https://github.com/theo/ledger", "https://x.com/theo", "payment-reconciler", 488, "published", 60, 52, 9310),
 (3, 4, "four-hours-one-missing-index", "Four hours finding one missing index",
  "A report page took nine seconds to load and nobody could say why. The session is mostly reading query plans and being wrong.\n\nIt turned out to be a correlated subquery in a view, three levels down, that nobody had opened since 2022. The fix is one index and two deleted lines.",
  "https://github.com/ana/reports", None, "index-hunt", 247, "published", 90, 80, 6140),
 (4, 6, "typography-pass-settings-screen", "A typography pass on a dense settings screen",
  "No new features. The settings screen had eleven type sizes on it. This session cuts it to four, sets everything on a four-point rhythm, and moves the destructive actions into their own group at the bottom.",
  None, "https://x.com/priya", "typography-pass", 196, "published", 130, 120, 3270),
 (5, 5, "board-bringup-without-uart", "Bringing up a board with no working UART",
  "The debug serial line was dead, so the whole session is done by blinking one LED in morse. By the end the clock tree is configured, the bootloader hands off correctly, and the UART turns out to have been fine all along: the pin was muxed to the wrong peripheral.",
  "https://github.com/kenji/board-bringup", None, "firmware-bringup", 615, "published", 170, 160, 11240),
 (6, 7, "rollback-before-the-migration", "Writing the rollback before the migration",
  "We are splitting a table that forty services read from. The session is spent writing the down-migration first and proving it on a branch of production data, because the only migration worth trusting is one you have already reversed once.",
  "https://github.com/dan/platform", None, "migration-rollback", 402, "published", 220, 210, 5480),
 (7, 8, "websocket-backpressure", "Adding backpressure to the websocket fan-out",
  "Slow clients were making the whole broadcast loop stall. This session adds a bounded buffer per connection and drops the slowest subscribers instead of blocking everyone else. The load test at the end pushes 40k messages a second through it.",
  "https://github.com/lena/realtime/pull/221", None, "payment-reconciler", 284, "in_review", 3, None, 0),
 (8, 2, "incremental-parsing-second-attempt", "Incremental parsing, second attempt",
  "Reworking the parser so an edit re-parses the changed subtree instead of the whole file. This session is the tree-diff groundwork: node identity, stable spans, and a test harness that replays real editing sessions against it.",
  "https://github.com/mira/lang", None, "index-hunt", 190, "in_review", 20, None, 0),
 (9, 9, "cleanup-session", "Cleanup session",
  "Cleaned up some code in the project and fixed a few things that were bothering me for a while.",
  None, None, "typography-pass", 35, "rejected", 40, None, 0),
]
REJECT_NOTE = "The write-up does not say what changed or why, and there is no link to the result. Describe the work in the recording and add the repository, then send it back."

donations = [
 # timelapse, donor user or None, amount SOL, message, hours ago, status
 (1, 3, 1.5, "The dead ends were the most useful part. Please keep leaving them in.", 20, "confirmed"),
 (1, None, 0.25, None, 12, "confirmed"),
 (2, 4, 2.0, "Watched this twice before touching our own reconciler.", 40, "confirmed"),
 (2, 5, 0.75, None, 30, "confirmed"),
 (3, 2, 0.5, "Keeping this for the next time a report page is slow.", 70, "confirmed"),
 (5, 7, 3.2, "Morse-code debugging deserves funding on principle.", 150, "confirmed"),
 (5, 6, 1.0, None, 100, "confirmed"),
 (6, 3, 1.25, "Rollback first. Taking that to my team.", 200, "confirmed"),
 (4, 8, 0.4, None, 2, "pending"),
]

notes = [
 (1, 3, "The part around the middle is worth watching twice. The fixpoint is computed over the dominator tree rather than the CFG, which is why the nested case stops miscompiling.", 12),
 (1, 4, "Leaving the two failing tests in rather than skipping them is the right call.", None),
 (2, 7, "Deriving the idempotency key from the provider event id is the whole fix. Everything else follows from it.", 9),
 (5, 2, "The moment the LED pattern changes at the end is a better demo than any logging output.", 15),
]

out = []
w = out.append
w("""-- Development seed. Refused when APP_ENV=production.
--
-- Mirrors the demo library the frontend ships with: one reviewer, eight
-- creators, six published sessions with the demo recordings in
-- frontend/public/demo, two waiting for review and one sent back, plus the
-- sponsorships, notes and audit trail that go with them.
--
-- Safe to re-run: it empties every table first.

BEGIN;

TRUNCATE note_votes, timelapse_notes, bookmarks, donations, timelapse_views,
         timelapses, audit_log, wallet_challenges, sessions, magic_link_tokens, users
         RESTART IDENTITY CASCADE;
""")

w("-- Accounts ------------------------------------------------------------------\n")
w("INSERT INTO users (id, email, email_verified_at, handle, display_name, role, bio,\n                   payout_address, payout_verified_at, created_at, last_seen_at)\nVALUES")
rows = []
for i, (n, handle, name, role, bio, has_wallet) in enumerate(users):
    wallet = wallets.get(n)
    rows.append(f"  ({q(uid(n))}, {q(handle + '@sardhana.test')}, now(), {q(handle)}, {q(name)}, {q(role)}, {q(bio)},\n"
                f"   {q(wallet)}, {'now()' if wallet else 'NULL'}, now() - interval '{400 - i * 40} days', now() - interval '{(i + 1) * 3} hours')")
w("\n" + ",\n".join(rows) + ";\n")

w("\n-- Sessions ------------------------------------------------------------------\n")
w("INSERT INTO timelapses (id, user_id, slug, title, summary, github_url, x_url,\n                        storage_key, playback_url, thumbnail_url, duration_seconds,\n                        session_minutes, status, submitted_at, published_at,\n                        reviewed_by, reviewed_at, review_note, view_count, created_at)\nVALUES")
rows = []
for (n, user, slug, title, summary, gh, x, video, minutes, status, sub_h, pub_h, views) in sessions:
    reviewed = status in ("published", "rejected")
    review_h = pub_h if status == "published" else (sub_h - 6 if status == "rejected" else None)
    rows.append(
        f"  ({q(tid(n))}, {q(uid(user))}, {q(slug)}, {q(title)},\n   {q(summary)},\n"
        f"   {q(gh)}, {q(x)}, {q(f'uploads/{uid(user)}/{slug}.mp4')},\n"
        f"   '/demo/{video}.mp4', '/demo/{video}.jpg', 18, {minutes}, '{status}',\n"
        f"   now() - interval '{sub_h} hours', {ago(pub_h)},\n"
        f"   {q(uid(1)) if reviewed else 'NULL'}, {ago(review_h if reviewed else None)}, "
        f"{q(REJECT_NOTE) if status == 'rejected' else 'NULL'}, {views}, now() - interval '{sub_h + 2} hours')")
w("\n" + ",\n".join(rows) + ";\n")

w("\n-- Sponsorships --------------------------------------------------------------\n")
w("INSERT INTO donations (timelapse_id, creator_id, donor_id, donor_address, payout_address,\n                       amount_lamports, message, signature, cluster, slot, status,\n                       confirmed_at, created_at)\nVALUES")
rows = []
for (t, donor, sol, msg, h, status) in donations:
    creator = next(s[1] for s in sessions if s[0] == t)
    sig = b58(88) if status == "confirmed" else None
    donor_addr = wallets.get(donor) if donor in wallets else b58(44)
    rows.append(
        f"  ({q(tid(t))}, {q(uid(creator))}, {q(uid(donor)) if donor else 'NULL'}, {q(donor_addr)}, {q(wallets[creator])},\n"
        f"   {round(sol * 1_000_000_000)}, {q(msg)}, {q(sig)}, 'devnet', {random.randint(300_000_000, 310_000_000) if sig else 'NULL'}, '{status}',\n"
        f"   {ago(h if status == 'confirmed' else None)}, now() - interval '{h} hours')")
w("\n" + ",\n".join(rows) + ";\n")

w("\n-- Notes and bookmarks -------------------------------------------------------\n")
w("INSERT INTO timelapse_notes (timelapse_id, author_id, body, timestamp_seconds)\nVALUES")
w("\n" + ",\n".join(f"  ({q(tid(t))}, {q(uid(a))}, {q(b)}, {ts if ts is not None else 'NULL'})" for (t, a, b, ts) in notes) + ";\n")
w("\nINSERT INTO bookmarks (user_id, timelapse_id)\nVALUES\n  (" + q(uid(3)) + ", " + q(tid(5)) + "),\n  (" + q(uid(4)) + ", " + q(tid(1)) + "),\n  (" + q(uid(2)) + ", " + q(tid(6)) + ");\n")

w("\n-- Audit trail: one entry per review decision above ---------------------------\n")
w("""INSERT INTO audit_log (actor_id, action, subject_type, subject_id, metadata, created_at)
SELECT reviewed_by,
       CASE status WHEN 'published' THEN 'timelapse.approve' ELSE 'timelapse.reject' END,
       'timelapse', id::text,
       CASE status WHEN 'published' THEN jsonb_build_object('title', title)
                   ELSE jsonb_build_object('title', title, 'note', review_note) END,
       reviewed_at
  FROM timelapses
 WHERE reviewed_at IS NOT NULL
 ORDER BY reviewed_at;
""")

w("\n-- Denormalised counters ------------------------------------------------------\n")
w("SELECT recount_totals();\n\nCOMMIT;\n")

open(Path(__file__).resolve().parent.parent / "database" / "seeds" / "dev_seed.sql", "w").write("".join(out))
