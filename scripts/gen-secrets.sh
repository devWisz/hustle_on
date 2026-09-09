#!/usr/bin/env bash
# Print a freshly generated secret for a new environment. Paste it into that
# environment's secret manager; do not write it into a tracked file.
set -euo pipefail

echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
