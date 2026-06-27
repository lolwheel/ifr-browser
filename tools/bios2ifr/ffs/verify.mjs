/* Reproducibility check for a build: run the same pipeline the page runs
 * (ffs.js + the built WASM) over a BIOS image and report SHA-256s.
 *
 *   node tools/bios2ifr/ffs/verify.mjs <bios.bin> [reference.ifr.txt] [distDir]
 *
 * distDir defaults to tools/bios2ifr/dist. If a reference .ifr.txt is given,
 * the extracted IFR text is diffed against it (trailing newlines ignored).
 * Test images / dumps are intentionally not committed — bring your own.
 */
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const bios = process.argv[2];
const ref = process.argv[3];
const dist = resolve(process.argv[4] || resolve(__dir, '..', 'dist'));
if (!bios) { console.error('usage: verify.mjs <bios.bin> [reference.ifr.txt] [distDir]'); process.exit(2); }

const FFS = require(resolve(__dir, 'ffs.js'));
const DecompFactory = (await import(resolve(dist, 'decomp.mjs'))).default;
const ifrMod = await import(resolve(dist, 'ifr-web', 'ifrextractor.js'));
await ifrMod.default({ module_or_path: readFileSync(resolve(dist, 'ifr-web', 'ifrextractor_bg.wasm')) });
const { extract } = ifrMod;

const sha256 = (u8) => createHash('sha256').update(u8).digest('hex');

function makeDecoder(mod) {
  const copyIn = (u8) => { const p = mod._malloc(u8.length || 1); mod.HEAPU8.set(u8, p); return p; };
  const lzma = (u8) => {
    const sp = copyIn(u8), zp = mod._malloc(4);
    let st = mod._wrap_lzma_get_size(sp, u8.length, zp);
    if (st !== 0) { mod._free(sp); mod._free(zp); return { status: st, data: null }; }
    const n = mod.getValue(zp, 'i32') >>> 0, dp = mod._malloc(n || 1);
    st = mod._wrap_lzma_decode(sp, u8.length, dp);
    const data = mod.HEAPU8.slice(dp, dp + n);
    mod._free(sp); mod._free(zp); mod._free(dp);
    return { status: st, data };
  };
  const efi = (u8) => {
    const sp = copyIn(u8), dsP = mod._malloc(4), ssP = mod._malloc(4);
    let st = mod._wrap_tiano_get_size(sp, u8.length, dsP, ssP);
    if (st !== 0) { mod._free(sp); mod._free(dsP); mod._free(ssP); return { status: st, data: null }; }
    const n = mod.getValue(dsP, 'i32') >>> 0, dp = mod._malloc(n || 1);
    let r = mod._wrap_efi_decode(sp, u8.length, dp, n, 0);
    if (r !== 0) r = mod._wrap_efi_decode(sp, u8.length, dp, n, 1);
    const data = mod.HEAPU8.slice(dp, dp + n);
    mod._free(sp); mod._free(dsP); mod._free(ssP); mod._free(dp);
    return { status: r, data };
  };
  return { lzma, efi };
}

const mod = await DecompFactory();
const image = new Uint8Array(readFileSync(bios));
const res = FFS.findSetup(image, makeDecoder(mod));
const cands = res.setup.length ? res.setup : res.all;
let chosen = null, full = null;
for (const m of cands) { const o = extract(m.data, true); if (o.includes('@@@IFR-SEGMENT')) { chosen = m; full = o; break; } }
if (!chosen) { console.error('no IFR found'); process.exit(1); }

const parts = full.split(/^@@@IFR-SEGMENT (.+) @@@\n/m);
let seg = null;
for (let i = 1; i + 1 < parts.length; i += 2) if (parts[i].endsWith('en-US.uefi')) { seg = parts[i + 1]; break; }
seg = (seg ?? parts[2] ?? full).replace(/\n+$/, '');

console.log(`modules: ${res.all.length}, Setup PE32: ${chosen.data.length} bytes`);
console.log(`PE32 body SHA256: ${sha256(chosen.data)}`);
console.log(`IFR text SHA256 : ${sha256(Buffer.from(seg, 'utf8'))}`);
if (ref && existsSync(ref)) {
  const refTxt = readFileSync(ref, 'utf8').replace(/\n+$/, '');
  console.log(seg === refTxt ? '✅ byte-identical to reference' : '❌ differs from reference');
  process.exitCode = seg === refTxt ? 0 : 1;
}
