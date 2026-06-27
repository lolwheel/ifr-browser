# Vendored UEFITool decompressors

These files are vendored **unmodified** (except for one `#include` path fix —
`../basetypes.h` → `basetypes.h` — to flatten the directory) from
[UEFITool](https://github.com/LongSoft/UEFITool) by LongSoft, used here only to
decompress firmware-volume sections in the browser.

- `EfiTianoDecompress.{c,h}` — EFI 1.1 / Tiano decompression
  (© Intel; © Nikolaj Schlej). BSD license.
- `LzmaDecompress.{c,h}` — EFI LZMA-guided section decompression
  (© Intel). BSD license.
- `basetypes.h` — EDK2-style integer typedefs (© Nikolaj Schlej). BSD license.
- `SDK/C/` — the 7-Zip LZMA SDK (© Igor Pavlov), public domain.

Only `EfiTianoDecompress.c`, `LzmaDecompress.c`, and `SDK/C/LzmaDec.c` are
compiled (plus the headers they include); the rest of `SDK/C` is kept intact so
those headers resolve.

The thin wrapper exposing these to JavaScript is `../decomp_wrap.c` (not vendored).
