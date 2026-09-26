"""Generate on-theme demo timelapses: an editor filling up over a compressed session."""
import re
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, SECONDS = 1280, 720, 24, 18
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

MONO = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 17)
MONO_S = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 14)
UI = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 15)
UI_B = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 22)

BG, PANEL, SIDE, LINE = (17, 18, 22), (23, 25, 30), (20, 21, 26), (38, 41, 48)
FG, MUTED, SUBTLE = (221, 224, 230), (140, 146, 158), (88, 94, 106)
KW, STR, NUM, COM, FN = (199, 146, 234), (163, 209, 140), (240, 170, 110), (100, 108, 122), (122, 176, 240)

KEYWORDS = set(
    "fn let mut if else for while return match struct impl pub use mod loop break continue "
    "func var const type package import range defer go select case switch default "
    "SELECT FROM WHERE JOIN ON AND OR CREATE INDEX TABLE ALTER ADD BEGIN COMMIT ROLLBACK AS "
    "INSERT INTO UPDATE SET NOT NULL EXISTS IN GROUP BY ORDER EXPLAIN ANALYZE DROP PRIMARY KEY "
    "void int uint32_t static volatile while include define return unsigned "
    "export function async await interface in ref true false nil err".split()
)
TOKEN = re.compile(r'(//.*|--.*|/\*.*?\*/|#\w+|"[^"]*"|\'[^\']*\'|\b\d[\w.]*\b|\b\w+\b|\s+|.)')


def colour(tok: str, nxt: str):
    if tok.startswith(("//", "--", "/*")):
        return COM
    if tok.startswith(("#",)):
        return KW
    if tok[:1] in "\"'":
        return STR
    if tok[:1].isdigit():
        return NUM
    if tok in KEYWORDS:
        return KW
    if nxt.startswith("("):
        return FN
    return FG


def draw_code_line(d, x, y, text):
    toks = TOKEN.findall(text)
    for i, tok in enumerate(toks):
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        d.text((x, y), tok, font=MONO, fill=colour(tok, nxt))
        x += MONO.getlength(tok)
    return x


def render(spec, name):
    code = spec["code"].strip("\n").split("\n")
    total_chars = sum(len(l) + 1 for l in code)
    frames = FPS * SECONDS
    accent = spec["accent"]
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen(
        [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "30",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / f"{name}.mp4")],
        stdin=subprocess.PIPE,
    )
    line_h, top, left = 26, 92, 300
    visible = (H - top - 170) // line_h
    for f in range(frames):
        t = f / (frames - 1)
        # Typing speeds up and slows down, like a real session does.
        progress = min(1.0, (t * 1.08) ** 0.92)
        shown = int(total_chars * progress)
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)

        # Title bar
        d.rectangle([0, 0, W, 44], fill=PANEL)
        for i, c in enumerate([(236, 95, 90), (240, 190, 80), (98, 196, 98)]):
            d.ellipse([18 + i * 22, 16, 30 + i * 22, 28], fill=c)
        d.text((100, 13), spec["repo"], font=UI, fill=MUTED)
        mins = int(spec["minutes"] * t)
        clock = f"SESSION  {mins // 60:02d}:{mins % 60:02d}"
        d.text((W - 24 - UI.getlength(clock), 13), clock, font=UI, fill=FG)
        d.ellipse([W - 40 - UI.getlength(clock), 19, W - 32 - UI.getlength(clock), 27],
                  fill=accent if f % 24 < 16 else PANEL)
        speed = f"{int(spec['minutes'] * 60 / SECONDS)}x"
        d.text((W / 2 - UI.getlength(speed) / 2, 13), speed, font=UI, fill=SUBTLE)

        # Sidebar
        d.rectangle([0, 44, 260, H], fill=SIDE)
        d.text((20, 62), "EXPLORER", font=MONO_S, fill=SUBTLE)
        for i, fname in enumerate(spec["files"]):
            active = i == spec.get("active", 0)
            y = 94 + i * 30
            if active:
                d.rectangle([8, y - 6, 252, y + 20], fill=LINE)
                d.rectangle([8, y - 6, 10, y + 20], fill=accent)
            d.text((24, y), fname, font=MONO_S, fill=FG if active else MUTED)

        # Tab
        d.rectangle([260, 44, W, 76], fill=PANEL)
        tab = spec["files"][spec.get("active", 0)].strip()
        d.rectangle([260, 44, 280 + MONO_S.getlength(tab) + 20, 76], fill=BG)
        d.rectangle([260, 74, 280 + MONO_S.getlength(tab) + 20, 76], fill=accent)
        d.text((280, 52), tab, font=MONO_S, fill=FG)

        # Code
        remaining, lines = shown, []
        for l in code:
            if remaining <= 0:
                break
            lines.append(l[:remaining])
            remaining -= len(l) + 1
        start = max(0, len(lines) - visible)
        cx, cy = left, top
        for i, l in enumerate(lines[start:]):
            y = top + i * line_h
            n = str(start + i + 1)
            d.text((left - 20 - MONO_S.getlength(n), y + 2), n, font=MONO_S, fill=SUBTLE)
            cx = draw_code_line(d, left, y, l)
            cy = y
        if f % 12 < 8:
            d.rectangle([cx + 1, cy + 2, cx + 3, cy + 22], fill=accent)

        # Terminal
        ty = H - 150
        d.rectangle([260, ty, W, H], fill=PANEL)
        d.line([260, ty, W, ty], fill=LINE)
        d.text((280, ty + 12), "TERMINAL", font=MONO_S, fill=SUBTLE)
        out = [line for at, line in spec["terminal"] if t >= at][-4:]
        for i, line in enumerate(out):
            fill = (120, 200, 140) if "pass" in line or "ok" in line else (230, 120, 110) if "FAIL" in line or "error" in line else MUTED
            d.text((280, ty + 40 + i * 24), line, font=MONO_S, fill=fill)

        # Progress rail along the bottom
        d.rectangle([0, H - 3, int(W * t), H], fill=accent)

        # Opening title card, fading out
        if t < 0.12:
            a = int(255 * (1 - t / 0.12) ** 1.5)
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            od = ImageDraw.Draw(overlay)
            od.rectangle([0, 0, W, H], fill=(12, 13, 16, a))
            od.text((80, H - 140), spec["title"], font=UI_B, fill=(245, 246, 248, a))
            od.text((80, H - 104), f"{spec['who']}  ·  {spec['minutes'] // 60}h {spec['minutes'] % 60}m of work",
                    font=UI, fill=(160, 166, 178, a))
            img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

        if abs(t - 0.72) < 0.5 / frames:
            img.save(OUT / f"{name}.jpg", quality=82)
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    proc.wait()
    print(name, (OUT / f"{name}.mp4").stat().st_size // 1024, "KB")


SPECS = {
    "borrow-checker": dict(
        title="Rewriting the borrow-checker pass", who="Mira Okonkwo", minutes=331,
        repo="lang — src/infer/lifetimes.rs", accent=(233, 120, 72),
        files=["  Cargo.toml", "  src/infer/mod.rs", "  src/infer/lifetimes.rs", "  src/infer/region.rs", "  tests/nested.rs"], active=2,
        terminal=[(0.2, "$ cargo test infer"), (0.35, "thread 'nested_closures' has overflowed its stack"),
                  (0.6, "$ cargo test infer"), (0.75, "test result: 142 passed; 2 FAILED"), (0.9, "$ git commit -m \"worklist: leave early-return FAIL documented\"")],
        code='''
use std::collections::VecDeque;

// The recursive walk blew the stack on closures nested fourteen deep.
// An explicit worklist trades readability for a bounded stack.
pub fn infer_lifetimes(body: &Body, cx: &mut InferCx) -> Result<(), InferError> {
    let mut work: VecDeque<BlockId> = VecDeque::new();
    let mut seen = vec![false; body.blocks.len()];
    work.push_back(body.entry);

    while let Some(block) = work.pop_front() {
        if seen[block.index()] {
            continue;
        }
        seen[block.index()] = true;

        for stmt in &body.blocks[block].statements {
            match stmt.kind {
                StmtKind::Borrow { place, region } => {
                    cx.constrain(region, cx.live_at(place, block))?;
                }
                StmtKind::Closure { ref captures, .. } => {
                    for cap in captures {
                        cx.outlives(cap.region, cx.scope_of(block));
                    }
                }
                _ => {}
            }
        }
        for succ in body.successors(block) {
            work.push_back(succ);
        }
    }
    cx.solve_fixpoint(body.dominators())
}
'''),
    "payment-reconciler": dict(
        title="A payment reconciler that survives a double refund", who="Theo Lindqvist", minutes=488,
        repo="ledger — internal/reconcile/refund.go", accent=(94, 160, 240),
        files=["  go.mod", "  internal/ledger/entry.go", "  internal/reconcile/refund.go", "  internal/reconcile/refund_test.go"], active=2,
        terminal=[(0.15, "$ go test ./internal/reconcile -run Double"), (0.3, "--- FAIL: TestDoubleRefund (balance -4200)"),
                  (0.7, "$ go test ./internal/reconcile"), (0.82, "ok   ledger/internal/reconcile  0.412s")],
        code='''
package reconcile

// Refund applies a provider refund exactly once. The idempotency key is
// derived from the provider event, so a webhook retry and a support agent
// racing each other write the same row and the second insert is a no-op.
func (r *Reconciler) Refund(ctx context.Context, ev ProviderEvent) error {
	key := idempotencyKey("refund", ev.ID)

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	inserted, err := r.ledger.Append(ctx, tx, Entry{
		Key:     key,
		Charge:  ev.ChargeID,
		Amount:  -ev.Amount,
		Kind:    KindRefund,
	})
	if err != nil {
		return fmt.Errorf("append refund: %w", err)
	}
	if !inserted {
		r.log.Info("refund already applied", "key", key)
		return nil
	}

	// Balance is computed, never stored, so it cannot drift.
	if bal := r.ledger.Balance(ctx, tx, ev.ChargeID); bal < 0 {
		return ErrNegativeBalance
	}
	return tx.Commit(ctx)
}
'''),
    "index-hunt": dict(
        title="Four hours finding one missing index", who="Ana Ruiz", minutes=247,
        repo="reports — db/views/monthly_summary.sql", accent=(120, 190, 150),
        files=["  db/views/monthly_summary.sql", "  db/migrations/0042_index.sql", "  notes/query-plans.md"], active=0,
        terminal=[(0.1, "Execution Time: 9184.221 ms"), (0.4, "-> Seq Scan on line_items (rows=4.1M)"),
                  (0.65, "CREATE INDEX"), (0.85, "Execution Time: 38.904 ms  ok")],
        code='''
-- Report page took nine seconds. The culprit is three views down.
EXPLAIN ANALYZE
SELECT a.id, a.name, s.total
FROM accounts a
JOIN monthly_summary s ON s.account_id = a.id
WHERE s.month = '2026-08-01';

-- monthly_summary, unchanged since 2022:
CREATE VIEW monthly_summary AS
SELECT li.account_id,
       date_trunc('month', li.created_at) AS month,
       sum(li.amount) AS total
FROM line_items li
WHERE EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = li.invoice_id
      AND i.voided_at IS NULL
)
GROUP BY 1, 2;

-- The correlated EXISTS scans line_items without this:
CREATE INDEX CONCURRENTLY line_items_invoice_created_idx
    ON line_items (invoice_id, created_at);

-- 9184 ms -> 39 ms. One index, two deleted lines.
'''),
    "typography-pass": dict(
        title="A typography pass on a dense settings screen", who="Priya Raman", minutes=196,
        repo="app — src/styles/settings.css", accent=(200, 140, 220),
        files=["  src/styles/tokens.css", "  src/styles/settings.css", "  src/pages/settings.tsx"], active=1,
        terminal=[(0.2, "$ npm run lint:css"), (0.3, "11 distinct font-size values found"),
                  (0.8, "$ npm run lint:css"), (0.9, "4 distinct font-size values  pass")],
        code='''
/* Eleven type sizes cut to four, all on a four-point rhythm. */
.settings {
  --step-0: 13px;
  --step-1: 15px;
  --step-2: 18px;
  --step-3: 24px;
  display: grid;
  gap: 32px;
  max-width: 720px;
}

.settings h2 {
  font-size: var(--step-2);
  line-height: 28px;
  letter-spacing: -0.01em;
}

.settings .field {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 16px;
  padding-block: 12px;
}

/* Destructive actions get their own group, last. */
.settings .danger-zone {
  border-top: 1px solid var(--border);
  padding-top: 24px;
  color: var(--danger);
}
'''),
    "firmware-bringup": dict(
        title="Bringing up a board with no working UART", who="Kenji Watanabe", minutes=615,
        repo="board-bringup — src/clock.c", accent=(236, 190, 90),
        files=["  include/pinmux.h", "  src/clock.c", "  src/main.c", "  Makefile"], active=1,
        terminal=[(0.15, "$ make flash"), (0.3, "LED: .... . .-.. .-.. ---"), (0.55, "error: USART1 TX muxed to AF4, expected AF7"),
                  (0.8, "$ make flash && screen /dev/tty.usb 115200"), (0.9, "boot: clocks ok, handing off  ok")],
        code='''
#include "pinmux.h"
#include "rcc.h"

// No working serial line, so progress is reported by blinking one LED.
static void blink(unsigned pattern) {
    for (int i = 0; i < 8; i++) {
        GPIOA->ODR = (pattern >> i) & 1 ? LED_ON : LED_OFF;
        delay_ms(120);
    }
}

void clock_init(void) {
    RCC->CR |= RCC_CR_HSEON;
    while (!(RCC->CR & RCC_CR_HSERDY)) {}
    blink(0x01);

    RCC->PLLCFGR = PLL_M(8) | PLL_N(336) | PLL_P(2) | RCC_PLLSRC_HSE;
    RCC->CR |= RCC_CR_PLLON;
    while (!(RCC->CR & RCC_CR_PLLRDY)) {}
    blink(0x03);

    FLASH->ACR = FLASH_LATENCY_5WS | FLASH_ICEN | FLASH_DCEN;
    RCC->CFGR |= RCC_CFGR_SW_PLL;
    blink(0x07);
}

// The UART was fine all along: the header had the wrong alternate function.
#define USART1_TX_AF 7
'''),
    "migration-rollback": dict(
        title="Writing the rollback before the migration", who="Dan Whitfield", minutes=402,
        repo="platform — migrations/0187_split_accounts.down.sql", accent=(110, 200, 210),
        files=["  0187_split_accounts.up.sql", "  0187_split_accounts.down.sql", "  scripts/verify.sh"], active=1,
        terminal=[(0.2, "$ neon branches create --name rollback-rehearsal"), (0.45, "$ ./scripts/verify.sh down"),
                  (0.7, "rows before 4,812,330  after 4,812,330  pass"), (0.88, "rollback rehearsed in 9m12s  ok")],
        code='''
-- Written first, proven on a branch of production data.
-- The only migration worth trusting is one you have already reversed.
BEGIN;

ALTER TABLE accounts
    ADD COLUMN billing_email TEXT,
    ADD COLUMN billing_plan  TEXT,
    ADD COLUMN billing_since TIMESTAMPTZ;

UPDATE accounts a
SET billing_email = b.email,
    billing_plan  = b.plan,
    billing_since = b.created_at
FROM account_billing b
WHERE b.account_id = a.id;

-- Forty services read these columns; keep them until every one moves.
CREATE INDEX accounts_billing_plan_idx ON accounts (billing_plan);

DROP TABLE account_billing;

COMMIT;
'''),
}

only = sys.argv[2:] or list(SPECS)
for name in only:
    render(SPECS[name], name)
