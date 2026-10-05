#!/usr/bin/env bash
set -euo pipefail

api_port="${COCOWHEELS_API_PORT:-5060}"
export COCOWHEELS_API_PROXY_TARGET="${COCOWHEELS_API_PROXY_TARGET:-http://127.0.0.1:${api_port}}"

PORT="$api_port" npm run dev:api &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run dev:web
