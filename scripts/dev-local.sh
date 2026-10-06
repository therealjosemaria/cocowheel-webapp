#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

api_port="${COCOWHEELS_API_PORT:-5060}"
export COCOWHEELS_API_PROXY_TARGET="${COCOWHEELS_API_PROXY_TARGET:-http://127.0.0.1:${api_port}}"

# Next may choose port 3001 when another local project already uses 3000. Keep
# the API private, but explicitly allow browser requests through this local proxy.
if [[ -z "${COCOWHEELS_FRONTEND_ORIGINS:-}" ]]; then
  dev_origins="http://localhost:3000,http://localhost:3001"
  if command -v tailscale >/dev/null 2>&1; then
    tailscale_ip="$(tailscale ip -4 2>/dev/null || true)"
    if [[ -n "$tailscale_ip" ]]; then
      dev_origins+=" ,http://${tailscale_ip}:3000,http://${tailscale_ip}:3001"
    fi
  fi
  export COCOWHEELS_FRONTEND_ORIGINS="$dev_origins"
fi

PORT="$api_port" npm run dev:api &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run dev:web
