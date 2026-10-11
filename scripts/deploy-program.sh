#!/usr/bin/env bash
# Build and deploy the sponsorship program, then point the API at it.
#
# Deploying is the one step in this repository that needs something the
# repository cannot supply: SOL on the target cluster, and the keypair that will
# own the program. This script does everything else — it builds, it checks the
# balance before spending anything, it deploys, and it writes the resulting
# program id into .env so the API verifies against it.
#
# Usage:
#   scripts/deploy-program.sh                 # deploy hustleon_pay to devnet
#   scripts/deploy-program.sh --cluster mainnet-beta
#   scripts/deploy-program.sh --check         # report what would happen, change nothing
set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER="devnet"
PROGRAM="hustleon_pay"
DO_CHECK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster) CLUSTER="$2"; shift 2 ;;
    --check)   DO_CHECK=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$CLUSTER" in
  devnet) RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}" ;;
  mainnet-beta) RPC="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}" ;;
  *) RPC="$CLUSTER" ;;
esac

KEYPAIR="$HOME/.config/solana/id.json"
SO="contracts/target/deploy/${PROGRAM}.so"
PROGRAM_KEYPAIR="contracts/target/deploy/${PROGRAM}-keypair.json"

command -v anchor >/dev/null || { echo "error: anchor is not installed" >&2; exit 1; }
[[ -f "$KEYPAIR" ]] || { echo "error: no keypair at $KEYPAIR (run: solana-keygen new)" >&2; exit 1; }

WALLET="$(solana address -k "$KEYPAIR")"
echo "cluster:  $CLUSTER"
echo "rpc:      $RPC"
echo "wallet:   $WALLET"

# --- build -------------------------------------------------------------------
# The program keypair is what fixes the program id. Losing it means the program
# can never be upgraded, so it is checked for before anything else and never
# regenerated silently.
if [[ ! -f "$PROGRAM_KEYPAIR" ]]; then
  echo "error: no program keypair at $PROGRAM_KEYPAIR." >&2
  echo "       Generate one with: anchor keys gen   (then run anchor keys sync)" >&2
  exit 1
fi
PROGRAM_ID="$(solana address -k "$PROGRAM_KEYPAIR")"
echo "program:  $PROGRAM_ID"

echo
echo "building…"
(cd contracts && anchor build)

[[ -f "$SO" ]] || { echo "error: $SO was not produced by the build" >&2; exit 1; }
SO_BYTES="$(wc -c < "$SO" | tr -d ' ')"
# Program data rent is charged per byte; the buffer that carries the upload is
# funded at the same rate and closed afterwards, so the peak is roughly twice the
# final cost plus fees.
NEEDED_LAMPORTS=$(( (SO_BYTES + 128) * 6960 * 2 + 20000000 ))
NEEDED_SOL="$(awk -v l="$NEEDED_LAMPORTS" 'BEGIN { printf "%.3f", l / 1000000000 }')"

BALANCE_LAMPORTS="$(solana balance "$WALLET" --url "$RPC" --lamports 2>/dev/null | awk '{print $1}')"
BALANCE_LAMPORTS="${BALANCE_LAMPORTS:-0}"
BALANCE_SOL="$(awk -v l="$BALANCE_LAMPORTS" 'BEGIN { printf "%.3f", l / 1000000000 }')"

echo
echo "program size: ${SO_BYTES} bytes"
echo "balance:      ${BALANCE_SOL} SOL"
echo "needed:       about ${NEEDED_SOL} SOL (program rent, plus a buffer that is refunded)"

if (( BALANCE_LAMPORTS < NEEDED_LAMPORTS )); then
  SHORTFALL="$(awk -v n="$NEEDED_LAMPORTS" -v b="$BALANCE_LAMPORTS" 'BEGIN { printf "%.3f", (n - b) / 1000000000 }')"
  echo
  echo "Not enough SOL: short by about ${SHORTFALL} SOL."
  echo
  echo "On devnet, top up the wallet above from the browser faucet — it needs a"
  echo "signed-in session and a captcha, so it cannot be automated from here:"
  echo "    https://faucet.solana.com/?address=${WALLET}"
  echo
  echo "Or, from a machine whose IP has not already used its allowance:"
  echo "    solana airdrop 2 ${WALLET} --url ${RPC}"
  exit 1
fi

if (( DO_CHECK )); then
  echo
  echo "--check: balance is sufficient; deploy skipped."
  exit 0
fi

# --- deploy ------------------------------------------------------------------
echo
echo "deploying…"
(cd contracts && anchor deploy --provider.cluster "$CLUSTER")

echo
echo "on chain:"
solana program show "$PROGRAM_ID" --url "$RPC" || true

# --- point the API at it -----------------------------------------------------
# Only this one key is rewritten. Rewriting the whole file would clobber
# everything else in .env, which is not this script's business.
if [[ -f .env ]]; then
  if grep -q '^HUSTLEON_PAY_PROGRAM_ID=' .env; then
    tmp="$(mktemp)"
    awk -v id="$PROGRAM_ID" '
      /^HUSTLEON_PAY_PROGRAM_ID=/ { print "HUSTLEON_PAY_PROGRAM_ID=" id; next }
      { print }
    ' .env > "$tmp" && mv "$tmp" .env
  else
    printf '\nHUSTLEON_PAY_PROGRAM_ID=%s\n' "$PROGRAM_ID" >> .env
  fi
  echo
  echo "wrote HUSTLEON_PAY_PROGRAM_ID=${PROGRAM_ID} to .env"
  echo "restart the API (make dev) so it verifies sponsorships against the program."
else
  echo
  echo "no .env here; set HUSTLEON_PAY_PROGRAM_ID=${PROGRAM_ID} where the API reads its config."
fi
