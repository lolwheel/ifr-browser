# ifrextractor-wasm

This is a small **fork of [IFRExtractor-RS](https://github.com/LongSoft/IFRExtractor-RS)**
by LongSoft (Nikolaj Schlej), licensed BSD-2-Clause (see `LICENSE`).

It is unmodified except for the changes needed to run the extractor in the
browser as a WebAssembly module instead of a command-line tool:

- `src/main.rs` was turned into `src/lib.rs`; `fn main` and all filesystem I/O
  were removed.
- `uefi_ifr_extract` / `framework_ifr_extract` now **return** the generated text
  (`Vec<u8>`) instead of writing per-package `.ifr.txt` files.
- A `#[wasm_bindgen] pub fn extract(data: &[u8], verbose: bool) -> String` entry
  point was added. It mirrors the upstream default extraction (all en-US UEFI /
  eng Framework form packages) and concatenates the per-package texts, each
  preceded by an `@@@IFR-SEGMENT <form>.<string>.<lang>.<kind> @@@` delimiter line.
- `Cargo.toml`: `crate-type = ["cdylib","rlib"]`, added `wasm-bindgen`, and
  `sha256 = { default-features = false }` (the default features pull in `tokio`,
  which does not build for `wasm32-unknown-unknown`).

`src/uefi_parser.rs` and `src/framework_parser.rs` are upstream, unchanged.

Upstream commit basis: IFRExtractor-RS v1.6.1.
