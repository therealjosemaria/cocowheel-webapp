#!/usr/bin/env bash
set -euo pipefail

api_url="${COCOWHEELS_API_URL:-http://127.0.0.1:5060}"
response="$(curl --fail --silent --show-error --max-time 5 "${api_url%/}/api/health")"

case "$response" in
  *'"status":"ok"'*) printf 'Cocowheels API healthy: %s\n' "$response" ;;
  *) printf 'Unexpected Cocowheels API response: %s\n' "$response" >&2; exit 1 ;;
esac
