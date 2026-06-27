# Third-party components

This project is MIT-licensed (see [LICENSE](LICENSE)). It redistributes the
following third-party components, each under its own permissive license.

## Bundled with the IFR Browser app (`assets/`)

- **setup_var.efi** — © datasone, MIT OR Apache-2.0.
  License: [`assets/licenses/setup_var.efi-LICENSE-MIT.txt`](assets/licenses/setup_var.efi-LICENSE-MIT.txt).
- **UEFI Shell (`BOOTX64.efi`)** — EDK2 / TianoCore, BSD-2-Clause-Patent.
  License: [`assets/licenses/UEFI-Shell-EDK2-License.txt`](assets/licenses/UEFI-Shell-EDK2-License.txt).

## Used to build the raw-BIOS → IFR page (`tools/bios2ifr/`)

- **IFRExtractor-RS** — © LongSoft (Nikolaj Schlej), BSD-2-Clause. Forked to a
  WASM library; changes documented in
  [`tools/bios2ifr/ifrextractor-wasm/NOTICE.md`](tools/bios2ifr/ifrextractor-wasm/NOTICE.md),
  license in [`tools/bios2ifr/ifrextractor-wasm/LICENSE`](tools/bios2ifr/ifrextractor-wasm/LICENSE).
- **UEFITool decompressors** (Tiano + LZMA) — © Intel, © Nikolaj Schlej, BSD.
  Vendored unmodified; see
  [`tools/bios2ifr/decomp/uefitool/NOTICE.md`](tools/bios2ifr/decomp/uefitool/NOTICE.md).
- **7-Zip LZMA SDK** — © Igor Pavlov, public domain.

These build inputs run **only in your browser** once compiled to WebAssembly;
nothing is uploaded.
