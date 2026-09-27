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
 (2, "ana", "Ana Ruiz", "member", "Painter. I record whole commissions, from the first wash to the last signature.", True),
 (3, "kenji", "Kenji Watanabe", "member", "Furniture maker working out of a small shared workshop. Hardwoods, hand tools, one table at a time.", True),
 (4, "priya", "Priya Raman", "member", "Pattern cutter and seamstress building a small clothing label, one prototype at a time.", True),
 (5, "theo", "Theo Lindqvist", "member", "Software engineer who does his best work after midnight. Mostly data tools and dashboards.", True),
 (6, "dan", "Dan Whitfield", "member", "Co-founder of a four-person startup. I film launch days so the team can see how the day went.", True),
 (7, "mira", "Mira Okonkwo", "member", "Freelance designer and developer. Portfolios, landing pages and small sites.", True),
 (8, "lena", "Lena Fischer", "member", "Ceramics student documenting a year of learning the wheel.", False),
 (9, "sofia", "Sofia Marin", "member", None, False),
]
wallets = {u[0]: b58(44) for u in users if u[5]}

sessions = [
 # n, user, slug, title, summary, github, x, video, seconds, minutes, status, submitted_h, published_h, views
 (1, 2, "portrait-commission", "Finishing a portrait commission in one sitting",
  "A client asked for a large abstract portrait for their studio. This session is the final six hours: blocking the colour fields, building up the face in layers, and fixing the left side twice after it read as flat from across the room.\n\nThe timelapse shows every false start. The finished piece shipped the next morning.",
  None, "https://x.com/ana", "painting-studio", 12, 372, "published", 30, 26, 4820),
 (2, 3, "walnut-side-table", "Building a walnut side table from rough boards",
  "Started with two rough-sawn walnut boards and ended with a finished side table. Most of the session is milling: flattening, jointing and planing until the boards were square, then cutting the joinery by hand.\n\nOne leg came out a millimetre short and I had to recut all four to match. It is in the recording.",
  None, None, "wood-workshop", 15, 488, "published", 60, 52, 9310),
 (3, 4, "lined-jacket-prototype", "Sewing the first prototype of a lined jacket",
  "The first physical sample for my label's autumn jacket. The session covers cutting the shell and lining, setting the sleeves, and a long stretch redoing the collar after it twisted on the first attempt.",
  None, "https://x.com/priya", "sewing-studio", 16, 247, "published", 90, 80, 6140),
 (4, 5, "late-night-trading-dashboard", "A late-night push on a live trading dashboard",
  "The dashboard was lagging seconds behind the market feed. This session moves the chart updates off the main thread and batches them, then load-tests it against a replay of a busy morning. The lag went from four seconds to under a hundred milliseconds.",
  "https://github.com/theo/dashboard/pull/41", None, "late-night-code", 14, 331, "published", 130, 120, 3270),
 (5, 6, "launch-day-four-person-team", "Launch day with a four-person team",
  "We launched the public beta of our booking app. The recording covers the whole working day in the office: final fixes in the morning, the release at noon, and the afternoon answering the first wave of support messages.",
  None, "https://x.com/dan", "office-sprint", 9, 615, "published", 170, 160, 11240),
 (6, 7, "portfolio-rebuild-afternoon", "Rebuilding my portfolio site in an afternoon",
  "My old portfolio took eight seconds to load on a phone. This session rebuilds it from scratch: a simpler layout, compressed images, and a contact form that actually sends. The new site loads in under a second.",
  "https://github.com/mira/portfolio", None, "writing-desk", 12, 402, "published", 220, 210, 5480),
 (7, 8, "first-set-of-bowls", "Throwing my first matching set of bowls",
  "Four bowls that are meant to match. The session is mostly centring clay and starting again when the walls went uneven. By the end three of the four are within a few millimetres of each other.",
  None, None, "painting-studio", 12, 284, "in_review", 3, None, 0),
 (8, 2, "gallery-mural-first-coat", "The first coat on a gallery mural",
  "Laying out and painting the base coat of a five-metre mural for a local gallery. The session covers the grid, transferring the sketch and the first pass of colour.",
  None, "https://x.com/ana", "painting-studio", 12, 190, "in_review", 20, None, 0),
 (9, 9, "work-session", "Work session",
  "Worked on some stuff for a few hours and made some progress on it.",
  None, None, "writing-desk", 12, 35, "rejected", 40, None, 0),
]
REJECT_NOTE = "The write-up does not say what you worked on or what came out of it. Describe the work in the recording and link the result if it is online, then send it back."

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
 (1, 3, "The part around the middle is worth watching twice. Seeing where you stepped back and changed the colour of the face taught me more than the finished piece.", 6),
 (1, 4, "Leaving the false starts in is the right call. Please keep doing that.", None),
 (2, 6, "Recutting all four legs instead of shimming one is the lesson here.", 9),
 (5, 2, "The moment the release goes out at noon is a better demo than any launch video.", 4),
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
for (n, user, slug, title, summary, gh, x, video, seconds, minutes, status, sub_h, pub_h, views) in sessions:
    reviewed = status in ("published", "rejected")
    review_h = pub_h if status == "published" else (sub_h - 6 if status == "rejected" else None)
    rows.append(
        f"  ({q(tid(n))}, {q(uid(user))}, {q(slug)}, {q(title)},\n   {q(summary)},\n"
        f"   {q(gh)}, {q(x)}, {q(f'uploads/{uid(user)}/{slug}.mp4')},\n"
        f"   '/demo/{video}.mp4', '/demo/{video}.jpg', {seconds}, {minutes}, '{status}',\n"
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
