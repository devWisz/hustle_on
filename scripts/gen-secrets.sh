#!/usr/bin/env bash
# Print freshly generated secrets for a new environment. Paste into the secret
# manager for that environment; do not write them into a tracked file.
set -euo pipefail

echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
echo "UPLOAD_SIGNING_KEY=$(openssl rand -base64 32 | tr -d '\n')"
echo "WEBHOOK_SIGNING_SECRET=$(openssl rand -hex 32)"
