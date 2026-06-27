/* Minimal WASM wrapper around UEFITool's Tiano + LZMA decompressors.
   Exposes clean (src,len,dst,len) entry points for the JS FFS walker. */
#include "basetypes.h"
#include "EfiTianoDecompress.h"
#include "LzmaDecompress.h"
#include <emscripten.h>
#include <stdlib.h>

/* LZMA: uncompressed size lives in the stream header. */
EMSCRIPTEN_KEEPALIVE
int wrap_lzma_get_size(const void *src, uint32_t srcSize, uint32_t *outSize) {
    return (int)LzmaGetInfo(src, srcSize, outSize);
}
EMSCRIPTEN_KEEPALIVE
int wrap_lzma_decode(const void *src, uint32_t srcSize, void *dst) {
    return (int)LzmaDecompress(src, srcSize, dst);
}

/* EFI/Tiano standard compression: GetInfo reports dst + scratch sizes. */
EMSCRIPTEN_KEEPALIVE
int wrap_tiano_get_size(const void *src, uint32_t srcSize, uint32_t *dstSize, uint32_t *scratchSize) {
    return (int)EfiTianoGetInfo(src, srcSize, dstSize, scratchSize);
}
/* variant 0 = EFI bit order, variant 1 = Tiano bit order. Scratch is internal. */
EMSCRIPTEN_KEEPALIVE
int wrap_efi_decode(const void *src, uint32_t srcSize, void *dst, uint32_t dstSize, int variant) {
    uint32_t ds = 0, ss = 0;
    if (EfiTianoGetInfo(src, srcSize, &ds, &ss) != U_SUCCESS) return -1;
    if (ds > dstSize) return -2;
    void *scratch = malloc(ss ? ss : 1);
    if (!scratch) return -3;
    int r;
    if (variant) r = (int)TianoDecompress(src, srcSize, dst, dstSize, scratch, ss);
    else         r = (int)EfiDecompress(src, srcSize, dst, dstSize, scratch, ss);
    free(scratch);
    return r;
}
