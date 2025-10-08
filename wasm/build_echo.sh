#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Requires Emscripten (emcc) in PATH
emcc echo.cpp -O3 -s STANDALONE_WASM=1 \
  -Wl,--export=echo -Wl,--export=malloc -Wl,--export=free \
  -o echo.wasm

echo "Built wasm/echo.wasm"
