#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Terminal A: runtime on 127.0.0.1:8787"
echo "  cd $ROOT/services/runtime && source .venv/bin/activate && python -m ensemble_runtime"
echo "Terminal B: canvas"
echo "  cd $ROOT && pnpm dev:canvas"
