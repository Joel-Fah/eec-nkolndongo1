/**
 * Prepares a photo in a Web Worker so the screen stays responsive (decision 0020): turns it upright, resizes
 * it to the requested widths, encodes WebP (JPEG where the browser cannot encode WebP, e.g. Safari) and builds
 * a tiny ThumbHash. Re-encoding through a canvas drops all metadata — EXIF, GPS, camera — by construction.
 */
import { rgbaToThumbHash } from 'thumbhash'

export type ProcessIn = { id: string; file: File; widths: number[] }
export type ProcessOut =
  | {
      id: string
      ok: true
      width: number
      height: number
      placeholder: string
      variants: { width: number; blob: Blob }[]
    }
  | { id: string; ok: false; reason: 'unreadable' }

const base64 = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

self.onmessage = async (e: MessageEvent<ProcessIn>) => {
  const { id, file, widths } = e.data
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const sizes = [...new Set(widths.map((w) => Math.min(w, bmp.width)))].sort((a, b) => a - b)
    const variants: { width: number; blob: Blob }[] = []
    for (const w of sizes) {
      const h = Math.max(1, Math.round((bmp.height * w) / bmp.width))
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bmp, 0, 0, w, h)
      let blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
      if (blob.type !== 'image/webp')
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 })
      variants.push({ width: w, blob })
    }
    const k = 100 / Math.max(bmp.width, bmp.height)
    const tw = Math.max(1, Math.round(bmp.width * k))
    const th = Math.max(1, Math.round(bmp.height * k))
    const small = new OffscreenCanvas(tw, th)
    const sctx = small.getContext('2d')
    if (!sctx) throw new Error('no 2d context')
    sctx.drawImage(bmp, 0, 0, tw, th)
    const rgba = sctx.getImageData(0, 0, tw, th).data
    const out: ProcessOut = {
      id,
      ok: true,
      width: bmp.width,
      height: bmp.height,
      placeholder: base64(rgbaToThumbHash(tw, th, rgba)),
      variants,
    }
    bmp.close()
    ;(self as unknown as Worker).postMessage(out)
  } catch {
    ;(self as unknown as Worker).postMessage({
      id,
      ok: false,
      reason: 'unreadable',
    } satisfies ProcessOut)
  }
}
