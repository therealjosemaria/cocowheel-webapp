#!/usr/bin/env bash
# Explicit operator setup only. Never downloads a model during a user's request.
set -euo pipefail
cutout_repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$cutout_repo"
python3 -m venv data/avatar-cutout-runtime
data/avatar-cutout-runtime/bin/pip install --only-binary=:all: -r workers/avatar/requirements-background.txt
mkdir -p data/avatar-cutout-models
cutout_model=data/avatar-cutout-models/u2net-human.onnx
cutout_digest=01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c
if [ ! -f "$cutout_model" ]; then
  cutout_temporary=$(mktemp data/avatar-cutout-models/model-download-XXXXXX)
  trap 'rm -f "$cutout_temporary"' EXIT
  curl --fail --location --proto '=https' --proto-redir '=https' --max-time 300 \
    https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx \
    --output "$cutout_temporary"
  printf '%s  %s\n' "$cutout_digest" "$cutout_temporary" | sha256sum --check --status
  mv "$cutout_temporary" "$cutout_model"
fi
if ! printf '%s  %s\n' "$cutout_digest" "$cutout_model" | sha256sum --check --status; then
  echo 'Model checksum differs. Move that file aside and rerun setup; do not use an unverified model.' >&2
  exit 1
fi
data/avatar-cutout-runtime/bin/python workers/avatar/background_remove.py --model "$cutout_model" --check
