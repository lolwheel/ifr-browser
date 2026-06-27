# bios2ifr — raw BIOS image → IFR, entirely in the browser

This builds **`bios2ifr.html`**: a single self-contained page that takes a raw
BIOS / SPI flash image, parses its UEFI firmware volumes, decompresses the
compressed sections, locates the **Setup** module, and extracts its IFR to text —
all client-side, nothing uploaded. It is the front end that produces the
`*.ifr.txt` the main [IFR Browser](../../README.md) consumes.

## How it works

```
raw BIOS image (e.g. 32 MB SPI dump)
  │  ffs/ffs.js            scan firmware volumes → FFS files → sections (read-path only)
  │  decomp/*  (WASM)      decompress COMPRESSION / GUID-defined (LZMA, Tiano) sections
  ▼
Setup module PE32 body
  │  ifrextractor-wasm     decode binary IFR + HII strings → text
  ▼
*.ifr.txt   (identical to UEFITool + IFRExtractor-RS output)
```

The hard, reusable pieces (LZMA/Tiano decompression, IFR decoding) are reused
from the established C / Rust tools, compiled to WASM. The firmware-volume
structure walk is plain JS, because it is just read-path header parsing.

| Part | Source | Language | Output |
|------|--------|----------|--------|
| `decomp/decomp_wrap.c` + `decomp/uefitool/` | UEFITool (vendored, BSD) | C → emcc | `decomp.mjs` (single-file ES module, ~40 KB) |
| `ifrextractor-wasm/` | IFRExtractor-RS (forked, BSD) | Rust → wasm-pack | `ifr-web/ifrextractor_bg.wasm` (~180 KB) |
| `ffs/ffs.js` | original | JS | firmware-volume walker |
| `web/template.html` + `web/assemble.py` | original | — | inlines all of the above into `bios2ifr.html` |

## Build

Hermetic (recommended) — toolchains stay in a throwaway image:

```sh
docker build -t ifr-wasm-dev tools/bios2ifr
docker run --rm -v "$PWD":/repo -w /repo ifr-wasm-dev bash tools/bios2ifr/build.sh /repo/dist
# → dist/bios2ifr.html
```

Native (needs `emcc`, `cargo` + `wasm32-unknown-unknown`, `wasm-pack`, `python3`):

```sh
bash tools/bios2ifr/build.sh dist
```

CI runs the native path on GitHub-hosted runners — see
[`.github/workflows/build-deploy.yml`](../../.github/workflows/build-deploy.yml).

## Verify (optional, needs your own dump)

`ffs/ffs.js` is the same code the page runs. To confirm a build reproduces a
known `UEFITool`+`IFRExtractor-RS` dump byte-for-byte, feed it a BIOS image and
compare the SHA-256 of the extracted IFR text against your reference. (Test
images and dumps are intentionally **not** committed.)

## Attribution

See [`ifrextractor-wasm/NOTICE.md`](ifrextractor-wasm/NOTICE.md) and
[`decomp/uefitool/NOTICE.md`](decomp/uefitool/NOTICE.md). Both upstreams are
BSD-licensed; the LZMA SDK is public domain.
