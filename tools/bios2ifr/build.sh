#!/usr/bin/env bash
# Build the raw-BIOS-to-IFR pipeline into a self-contained page.
#
#   tools/bios2ifr/build.sh [OUT_DIR]      (default: tools/bios2ifr/dist)
#
# Requires emcc (Emscripten), cargo + wasm32 target, wasm-pack, python3 on PATH.
# For a hermetic build use the bundled Dockerfile:
#   docker build -t ifr-wasm-dev tools/bios2ifr
#   docker run --rm -v "$PWD":/repo -w /repo ifr-wasm-dev bash tools/bios2ifr/build.sh /repo/dist
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/dist}"
mkdir -p "$OUT"

echo "[1/3] decompressor WASM (Tiano + LZMA, emcc, single-file ES module)"
emcc -O2 -I"$HERE/decomp/uefitool" \
  "$HERE/decomp/decomp_wrap.c" \
  "$HERE/decomp/uefitool/EfiTianoDecompress.c" \
  "$HERE/decomp/uefitool/LzmaDecompress.c" \
  "$HERE/decomp/uefitool/SDK/C/LzmaDec.c" \
  -o "$OUT/decomp.mjs" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sSINGLE_FILE=1 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS='_wrap_lzma_get_size,_wrap_lzma_decode,_wrap_tiano_get_size,_wrap_efi_decode,_malloc,_free' \
  -sEXPORTED_RUNTIME_METHODS='getValue,setValue,HEAPU8'

echo "[2/3] IFRExtractor WASM (Rust, wasm-pack, web target)"
( cd "$HERE/ifrextractor-wasm" && wasm-pack build --release --target web --out-dir "$OUT/ifr-web" )

echo "[3/3] assemble self-contained bios2ifr.html"
python3 "$HERE/web/assemble.py" "$OUT"

echo "Done -> $OUT/bios2ifr.html"
