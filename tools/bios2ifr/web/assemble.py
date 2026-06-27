#!/usr/bin/env python3
"""Inline the built WASM artifacts into the self-contained pages.

Usage: assemble.py [OUT_DIR]
  OUT_DIR defaults to tools/bios2ifr/dist and must already contain the build
  outputs: decomp.mjs and ifr-web/ifrextractor.{js,_bg.wasm}.

Produces:
  OUT_DIR/bios2ifr.html  — standalone raw-BIOS → IFR extractor (from web/template.html)
  OUT_DIR/index.html     — the unified IFR Browser app (from the repo-root index.html),
                           with the firmware pipeline embedded so it can ingest a raw
                           BIOS image as well as a .ifr.txt. The USB-bundle binaries are
                           still fetched from assets/ at runtime (small hosted page).
  OUT_DIR/ifr-browser-offline.html
                         — same app but with the UEFI Shell + setup_var.efi ALSO embedded,
                           so even the USB-bundle export works with zero network. One file,
                           fully offline. Shipped as a GitHub release asset.
"""
import base64, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))                  # tools/bios2ifr/web
TOOL = os.path.dirname(HERE)                                       # tools/bios2ifr
ROOT = os.path.abspath(os.path.join(TOOL, "..", ".."))             # repo root
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(TOOL, "dist")

FFS = os.path.join(TOOL, "ffs", "ffs.js")
DECOMP = os.path.join(OUT, "decomp.mjs")
IFRJS = os.path.join(OUT, "ifr-web", "ifrextractor.js")
IFRWASM = os.path.join(OUT, "ifr-web", "ifrextractor_bg.wasm")

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def b64_str(s):
    return base64.b64encode(s.encode("utf-8")).decode()

def neutralize(s):
    return s.replace("</script", "<\\/script")

ffs_src = open(FFS, encoding="utf-8").read()
decomp_b64 = b64(DECOMP)
ifrjs_b64 = b64(IFRJS)
ifrwasm_b64 = b64(IFRWASM)

def fill(template_path, repl):
    with open(template_path, encoding="utf-8") as f:
        html = f.read()
    for k, v in repl.items():
        html = html.replace(k, v)
    return html

# Standalone extractor — FFS inlined raw, binaries as base64.
bios = fill(os.path.join(HERE, "template.html"), {
    "__FFS_JS__": neutralize(ffs_src),
    "__DECOMP_MJS_B64__": decomp_b64,
    "__IFR_JS_B64__": ifrjs_b64,
    "__IFR_WASM_B64__": ifrwasm_b64,
})
with open(os.path.join(OUT, "bios2ifr.html"), "w", encoding="utf-8") as f:
    f.write(bios)
print("assembled", os.path.join(OUT, "bios2ifr.html"), len(bios), "bytes")

# Unified app — FFS loaded as a base64 ES side-effect import (sets globalThis.FFS).
app = fill(os.path.join(ROOT, "index.html"), {
    "__FFS_B64__": b64_str(ffs_src),
    "__DECOMP_MJS_B64__": decomp_b64,
    "__IFR_JS_B64__": ifrjs_b64,
    "__IFR_WASM_B64__": ifrwasm_b64,
})
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
    f.write(app)
print("assembled", os.path.join(OUT, "index.html"), len(app), "bytes")

# Fully-offline single file — additionally embed the USB-bundle binaries so the
# `bundle .zip` export needs no network (getBins() uses the inlined base64).
shell_b64 = b64(os.path.join(ROOT, "assets", "BOOTX64.efi"))
setupvar_b64 = b64(os.path.join(ROOT, "assets", "setup_var.efi"))
offline = (app
           .replace('id="bin-shell"></script>', 'id="bin-shell">' + shell_b64 + '</script>')
           .replace('id="bin-setupvar"></script>', 'id="bin-setupvar">' + setupvar_b64 + '</script>'))
with open(os.path.join(OUT, "ifr-browser-offline.html"), "w", encoding="utf-8") as f:
    f.write(offline)
print("assembled", os.path.join(OUT, "ifr-browser-offline.html"), len(offline), "bytes")
