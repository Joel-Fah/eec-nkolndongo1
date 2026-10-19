/**
 * Generates favicons and app icons from packages/ui/brand/mark.svg into apps/web/public and
 * apps/admin/public. Run after changing the mark: `pnpm --filter @eec/scripts brand:icons`.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'packages/ui/brand')
const targets = [join(root, 'apps/web/public'), join(root, 'apps/admin/public')]

// Light background of the site (--bg, light theme) — app icons sit on it.
const CREAM = '#FBF8F1'

const mark = await readFile(join(brand, 'mark.svg'), 'utf8')
// Dark-theme --ink: a cream halo keeps the black outlines visible in dark browser chrome.
const HALO = '#F3EFE6'

/** favicon.svg: the colour mark, plus a halo underlay shown only in dark mode (reuses its paths). */
function faviconSvg(): string {
  const [, open = '', inner = ''] = /^(<svg[^>]*>)([\s\S]*)<\/svg>\s*$/.exec(mark) ?? []
  const defsEnd = inner.indexOf('</defs>') + '</defs>'.length
  const underlay =
    `<g class="halo" fill="${HALO}" stroke="${HALO}" stroke-width="28.5" stroke-linejoin="round">` +
    ['s', 'e1', 'e2', 'c3', 'x'].map((id) => `<use href="#eec-${id}"/>`).join('') +
    '</g>'
  const style =
    '<style>.halo{display:none}@media (prefers-color-scheme:dark){.halo{display:inline}}</style>'
  return `${open}${style}${inner.slice(0, defsEnd)}${underlay}${inner.slice(defsEnd)}</svg>\n`
}

/** Square PNG with the mark centred at `scale` of the side, on a cream background (or transparent). */
async function png(size: number, scale: number, background: string | null): Promise<Buffer> {
  const inner = Math.round(size * scale)
  const art = await sharp(Buffer.from(mark), { density: 600 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** ICO container holding one PNG image (supported by every current browser). */
function ico(pngData: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // image count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size % 256, 0)
  entry.writeUInt8(size % 256, 1)
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngData.length, 8)
  entry.writeUInt32LE(6 + 16, 12)
  return Buffer.concat([header, entry, pngData])
}

const outputs: Record<string, Buffer | string> = {
  'favicon.svg': faviconSvg(),
  'favicon.ico': ico(await png(32, 1, null), 32),
  'apple-touch-icon.png': await png(180, 0.72, CREAM),
  // Maskable: keep the mark inside the 80% safe circle.
  'icon-192.png': await png(192, 0.6, CREAM),
  'icon-512.png': await png(512, 0.6, CREAM),
}

for (const dir of targets) {
  await mkdir(dir, { recursive: true })
  for (const [name, data] of Object.entries(outputs)) await writeFile(join(dir, name), data)
}
await copyFile(join(brand, 'mark.svg'), join(targets[0] ?? '', 'mark.svg'))

// Admin: its own dark-only, terminal-flavoured icon (never the public mark).
const adminDir = join(root, 'apps/admin/public')
const adminSvg = await readFile(join(root, 'scripts/brand-assets/admin-favicon.svg'))
const adminPng = (size: number) =>
  sharp(adminSvg, { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
await writeFile(join(adminDir, 'favicon.svg'), adminSvg)
await writeFile(join(adminDir, 'favicon.ico'), ico(await adminPng(32), 32))
await writeFile(join(adminDir, 'apple-touch-icon.png'), await adminPng(180))
await writeFile(join(adminDir, 'icon-192.png'), await adminPng(192))
await writeFile(join(adminDir, 'icon-512.png'), await adminPng(512))
console.log(`Icons written to ${targets.length} apps: ${Object.keys(outputs).join(', ')}`)
