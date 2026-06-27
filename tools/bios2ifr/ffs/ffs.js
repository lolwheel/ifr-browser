/* Minimal UEFI firmware-volume / FFS / section walker (read path only).
 *
 * Locates the "Setup" module's PE32 section body inside a raw BIOS image,
 * decompressing compressed / GUID-defined sections via an injected decoder.
 *
 * decoder = {
 *   lzma(u8) -> { status, data:Uint8Array },   // EFI LZMA-guided
 *   efi(u8)  -> { status, data:Uint8Array },    // EFI/Tiano standard + Tiano-guided
 * }
 *
 * Works in node and the browser; no DOM/fs dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FFS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- GUIDs (raw 16-byte little-endian form, as lowercase hex) ----
  const GUID_LZMA   = '98584eee143959429d6edc7bd79403cf';
  const GUID_TIANO  = 'ad8012a31e48b64195e8127f4c984779';
  const GUID_CRC32  = 'b0cd1bfc317daa49936aa4600d9dd083';
  // (brotli '5020533dda5cd04f879e0f7f630d5afb' intentionally unsupported)

  const FV_SIG = 0x4856465f; // "_FVH" little-endian u32

  // Section types
  const S_COMPRESSION = 0x01, S_GUID_DEFINED = 0x02, S_PE32 = 0x10,
        S_FV_IMAGE = 0x17, S_USER_INTERFACE = 0x15, S_RAW = 0x19;

  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u24 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const align = (n, a) => (n + (a - 1)) & ~(a - 1);

  function guidHex(b, o) {
    let s = '';
    for (let i = 0; i < 16; i++) s += b[o + i].toString(16).padStart(2, '0');
    return s;
  }
  // CHAR16 (UTF-16LE) -> string, stopping at NUL
  function ucs2(b, o, end) {
    let s = '';
    for (let i = o; i + 1 < end; i += 2) {
      const c = u16(b, i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  // Parse one section list (a contiguous run of EFI_COMMON_SECTION_HEADER).
  // ctx collects results; inheritedName carries a UI name from an outer scope.
  function walkSections(buf, ctx, inheritedName) {
    // First pass: a USER_INTERFACE section names every PE32 in this scope.
    let scopeName = inheritedName || null;
    let p = 0;
    while (p + 4 <= buf.length) {
      let size = u24(buf, p);
      let type = buf[p + 3];
      let hdr = 4;
      if (size === 0xffffff) { size = u32(buf, p + 4); hdr = 8; }
      if (size < hdr || p + size > buf.length) break;
      if (type === S_USER_INTERFACE) scopeName = ucs2(buf, p + hdr, p + size);
      p = align(p + size, 4);
    }

    // Second pass: process.
    p = 0;
    while (p + 4 <= buf.length) {
      let size = u24(buf, p);
      let type = buf[p + 3];
      let hdr = 4;
      if (size === 0xffffff) { size = u32(buf, p + 4); hdr = 8; }
      if (size < hdr || p + size > buf.length) break;

      const body = buf.subarray(p + hdr, p + size);

      if (type === S_PE32) {
        ctx.pe32.push({ name: scopeName, data: body.slice() });
      } else if (type === S_COMPRESSION) {
        // UINT32 UncompressedLength, UINT8 CompressionType, then data
        const ctype = buf[p + hdr + 4];
        const cdata = buf.subarray(p + hdr + 5, p + size);
        if (ctype === 0x00) {
          walkSections(cdata, ctx, scopeName);
        } else if (ctype === 0x01) {
          const r = ctx.decoder.efi(cdata);
          if (r && r.status === 0) walkSections(r.data, ctx, scopeName);
          else ctx.errors.push('EFI/Tiano standard decompress failed status=' + (r && r.status));
        }
      } else if (type === S_GUID_DEFINED) {
        const g = guidHex(buf, p + hdr);
        const dataOffset = u16(buf, p + hdr + 16);
        const payload = buf.subarray(p + dataOffset, p + size);
        if (g === GUID_LZMA) {
          const r = ctx.decoder.lzma(payload);
          if (r && r.status === 0) walkSections(r.data, ctx, scopeName);
          else ctx.errors.push('LZMA decompress failed status=' + (r && r.status));
        } else if (g === GUID_TIANO) {
          const r = ctx.decoder.efi(payload);
          if (r && r.status === 0) walkSections(r.data, ctx, scopeName);
          else ctx.errors.push('Tiano-guided decompress failed status=' + (r && r.status));
        } else if (g === GUID_CRC32) {
          walkSections(payload, ctx, scopeName); // not compressed, just CRC-wrapped
        } else {
          ctx.skipped.push('guid-section ' + g);
        }
      } else if (type === S_FV_IMAGE) {
        walkFV(body, ctx);
      }
      p = align(p + size, 4);
    }
  }

  // Parse a firmware volume at buf[0..], walking its FFS files' sections.
  function walkFV(buf, ctx) {
    if (buf.length < 0x40 || u32(buf, 0x28) !== FV_SIG) return;
    const fvLen = u32(buf, 0x20); // low 32 bits of FvLength (enough for our sizes)
    const hdrLen = u16(buf, 0x30);
    const extOff = u16(buf, 0x34); // 0x32 is Checksum; ExtHeaderOffset is at 0x34
    let start = hdrLen;
    if (extOff) {
      // EFI_FIRMWARE_VOLUME_EXT_HEADER: GUID(16) + ExtHeaderSize(u32)
      const extSize = u32(buf, extOff + 16);
      start = align(extOff + extSize, 8);
    }
    const fvEnd = Math.min(fvLen || buf.length, buf.length);

    let fp = align(start, 8);
    while (fp + 24 <= fvEnd) {
      // EFI_FFS_FILE_HEADER
      let fsize = u24(buf, fp + 20);
      const attrib = buf[fp + 19];
      const ftype = buf[fp + 18];
      let fhdr = 24;
      if (attrib & 0x01) { // FFS_ATTRIB_LARGE_FILE -> header2 with UINT64 ExtendedSize
        fsize = u32(buf, fp + 24); // low 32 bits
        fhdr = 32;
      }
      // End of files: erased space (size all-FF) or zero size
      if (fsize === 0xffffff || fsize === 0 || fp + fsize > fvEnd) break;

      // Skip pad (0xF0) and raw (0x01) files; parse sections of the rest.
      if (ftype !== 0xf0 && ftype !== 0x01 && ftype !== 0xff) {
        const sectionArea = buf.subarray(fp + fhdr, fp + fsize);
        walkSections(sectionArea, ctx, null);
      }
      fp = align(fp + fsize, 8);
    }
  }

  // Scan a whole flash image for top-level firmware volumes.
  function findVolumes(buf, ctx) {
    for (let i = 0; i + 0x40 <= buf.length; i += 8) {
      if (u32(buf, i + 0x28) === FV_SIG) {
        const sub = buf.subarray(i);
        const before = ctx.pe32.length;
        walkFV(sub, ctx);
        const fvLen = u32(buf, i + 0x20);
        void before;
        if (fvLen > 8) i = align(i + fvLen, 8) - 8; // jump past this FV
      }
    }
  }

  // Public: return all PE32 bodies (with their module names) in an image.
  function extractPe32(image, decoder) {
    const ctx = { decoder, pe32: [], errors: [], skipped: [] };
    findVolumes(image, ctx);
    return ctx;
  }

  // Public: find the Setup module's PE32 body. Falls back to any PE32 that
  // looks like it carries HII (caller can verify with the IFR extractor).
  function findSetup(image, decoder) {
    const ctx = extractPe32(image, decoder);
    const named = ctx.pe32.filter(m => m.name === 'Setup');
    return { setup: named, all: ctx.pe32, errors: ctx.errors, skipped: ctx.skipped };
  }

  return { extractPe32, findSetup, walkFV, walkSections, GUID_LZMA, GUID_TIANO };
});
