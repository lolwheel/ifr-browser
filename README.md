# BIOS IFR Browser

A single-file, offline web app for exploring and editing **AMI Aptio UEFI Setup** menus from an extracted **IFR** (Internal Forms Representation) text dump — and generating the `setup_var.efi` commands to apply your changes.

**[▶ Open the app](https://lolwheel.github.io/ifr-browser/)** · drag a `.ifr.txt` dump onto the page.

Everything runs **entirely in your browser** — your dump is parsed in JavaScript and never leaves your machine. The loaded dump and your pending edits are saved locally (IndexedDB + localStorage) and auto-reload on your next visit.

## Why

OEM laptops and mini-PCs (Minisforum, Beelink, etc.) ship AMI BIOSes with most of the useful CPU/power/VR menus **hidden**. Tools like [`setup_var.efi`](https://github.com/datasone/setup_var.efi) / [setupvar-builder](https://github.com/ab3lkaizen/setupvar-builder) let you write those hidden settings from the UEFI shell by raw VarStore **offset** — but finding the right offset, value, and which lock gates what is painful. This app turns the BIOS's own IFR dump into a navigable, searchable, *editable* UI and writes the exact commands for you.

## Features

- **Forms render like real BIOS screens** — submenu navigation, breadcrumb, browser back/forward, deep-links (`#0x27F0`).
- **Resolved conditions** — `SuppressIf` / `GrayOutIf` expressions are decoded to readable, *clickable* references (e.g. *"grayed-out when `OverClocking Feature @CpuSetup:0x1D9 == 0x0`"*).
- **Incoming references** — every form shows which forms link to it; sidebar lists only root forms.
- **Fuzzy search** across names, help text, options, offsets and commands — ranked by match contiguity, with the matched field/snippet highlighted.
- **Live editing → `startup.nsh`** — change any dropdown / value and the exact `setup_var.efi <off> <hexval> -s 0x<bytes> -n <VarStore>` line accumulates in a panel you can **copy** or **save**. Items are clickable (jump to the setting) and removable (revert). Changes persist across reloads.

## How to get an IFR dump

1. Dump your BIOS region (vendor tool, [AFU](https://www.ami.com/), or a CH341A SPI programmer).
2. Extract the Setup form module with [UEFITool](https://github.com/LongSoft/UEFITool) → find the `Setup` PE32 section.
3. Convert it to text with [IFRExtractor-RS](https://github.com/LongSoft/IFRExtractor-RS).
4. Drag the resulting `*.ifr.txt` onto the app.

## ⚠️ Disclaimer

Writing BIOS VarStore values via `setup_var.efi` can make your system unstable or unbootable. Understand each setting, keep a way to recover (CMOS clear / external SPI flasher), and proceed at your own risk. This tool only *generates* commands — it never touches your firmware.

## License

MIT — see [LICENSE](LICENSE).
