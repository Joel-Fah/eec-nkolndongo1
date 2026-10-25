/**
 * `pnpm --filter @eec/scripts social:kit` — the social media kit of the brand guide: cover banners (Facebook, X, YouTube) and square profile
 * pictures (Facebook, X, Instagram, YouTube, WhatsApp), into apps/web/public/brand/social/. Run by hand when the brand changes and commit
 * the result (nothing is generated at runtime). The art is « ribbons of light »: flowing translucent bands of gold, clay and cream over
 * the parish's deep green, unlike the soft circles used across the site. The mark is placed, never altered, in one corner of the banners
 * (inside the strip every phone shows) and in the middle of the pictures. Needs `playwright-core` + Chrome (see og-generate.ts) and `sharp`.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import sharp from 'sharp'
import { AVATAR_VARIANTS, AVATARS, BANNERS } from '../apps/web/src/lib/social-kit.ts'

const root = join(import.meta.dirname, '..')
const require = createRequire(join(root, 'scripts/.cache/pw/'))
const { chromium } = (() => {
  try {
    return require('playwright-core') as typeof import('playwright-core')
  } catch {
    return createRequire(import.meta.url)('playwright-core') as typeof import('playwright-core')
  }
})()
const out = join(root, 'apps/web/public/brand/social')
mkdirSync(out, { recursive: true })
const brand = (f: string) => readFileSync(join(root, 'packages/ui/brand', f), 'utf8')
const font = (f: string) =>
  `data:font/woff2;base64,${readFileSync(join(root, 'packages/ui/fonts/fontshare', f)).toString('base64')}`
const fr = JSON.parse(readFileSync(join(root, 'packages/i18n/messages/fr.json'), 'utf8'))

const DEEP = '#0E3A24'
const GREEN = '#1F5C3A'
const GOLD = '#E8B931'
const CLAY = '#D9643A'
const CREAM = '#FBF8F1'

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ribbons of light: each band is a smooth sweep across the picture with a thickness that swells and thins. */
function ribbons(seed: number, w: number, h: number): string {
  const r = rng(seed)
  const n = 11
  const steps = 90
  const defs: string[] = []
  const bands: string[] = []
  const pal = [GOLD, CLAY, CREAM, GOLD, '#8FD0A4']
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const amp = h * (0.1 + r() * 0.2)
    const freq = 0.7 + r() * 1.3
    const phase = r() * Math.PI * 2
    const slope = h * (0.55 - r() * 0.15)
    const base = h * (0.95 - t * 0.9)
    const thick = h * (0.05 + r() * 0.12)
    const swell = 0.4 + r() * 0.6
    const top: string[] = []
    const bottom: string[] = []
    for (let s = 0; s <= steps; s++) {
      const u = s / steps
      const x = -w * 0.05 + u * w * 1.1
      const y = base - slope * (u - 0.5) + amp * Math.sin(u * Math.PI * 2 * freq + phase)
      const th = thick * (0.45 + swell * Math.sin(u * Math.PI * (1 + r() * 0.0) + phase * 0.3) ** 2)
      top.push(`${x.toFixed(1)} ${(y - th).toFixed(1)}`)
      bottom.push(`${x.toFixed(1)} ${(y + th).toFixed(1)}`)
    }
    const c1 = pal[Math.floor(r() * pal.length)] as string
    const c2 = pal[Math.floor(r() * pal.length)] as string
    defs.push(
      `<linearGradient id="g${i}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${c1}" stop-opacity="0"/><stop offset="0.35" stop-color="${c1}" stop-opacity="${(0.28 + r() * 0.4).toFixed(2)}"/><stop offset="0.7" stop-color="${c2}" stop-opacity="${(0.25 + r() * 0.4).toFixed(2)}"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></linearGradient>`,
    )
    bands.push(
      `<path d="M${top.join(' L')} L${bottom.reverse().join(' L')} Z" fill="url(#g${i})" style="mix-blend-mode:screen"/>`,
    )
  }
  // A low sun and a scatter of fine dots: the light the ribbons come from.
  const sx = w * (0.62 + r() * 0.2)
  const sy = h * (0.15 + r() * 0.15)
  const dots = Array.from({ length: Math.round((w * h) / 9000) }, () => {
    const x = r() * w
    const y = r() * h
    const o = 0.1 + r() * 0.45
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.8 + r() * 2.2).toFixed(1)}" fill="${CREAM}" opacity="${o.toFixed(2)}"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="bg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${DEEP}"/><stop offset="1" stop-color="${GREEN}"/></linearGradient><radialGradient id="sun"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.55"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="url(#bg)"/><circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${(h * 0.7).toFixed(0)}" fill="url(#sun)"/>${bands.join('')}${dots.join('')}</svg>`
}

const SEED = 20261025
const markHalo = brand('mark-halo.svg')
const markPlain = brand('mark.svg')

/** A banner: the ribbons, and the mark with the parish name in one corner, inside the strip every phone shows. */
const bannerHtml = (w: number, h: number) => {
  const mh = Math.round(h * (h > w * 0.45 ? 0.1 : 0.17))
  const mw = Math.round(mh * (850 / 826))
  const inset = Math.round(w * 0.14)
  const top = Math.round(h * (h > w * 0.45 ? 0.36 : 0.17))
  const name = Math.round(mh * 0.34)
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Erode;src:url(${font('erode/Erode-Variable.woff2')}) format('woff2');font-weight:300 700}
*{box-sizing:border-box;margin:0}
body{width:${w}px;height:${h}px;position:relative;overflow:hidden;background:${DEEP}}
svg.art{position:absolute;inset:0}
.tag{position:absolute;right:${inset}px;top:${top}px;display:flex;align-items:center;gap:${Math.round(mh * 0.28)}px;color:${CREAM}}
.mark{width:${mw}px;height:${mh}px;flex:none}
.mark svg{width:100%;height:100%}
.nm{font-family:Erode,serif;font-weight:500;font-size:${name}px;line-height:1.05;letter-spacing:-.01em;text-shadow:0 2px 12px rgba(0,0,0,.35)}
</style>${ribbons(SEED, w, h).replace('<svg ', '<svg class="art" ')}
<div class="tag"><div class="mark">${markHalo}</div><div class="nm">${fr.site.parish.replace(' de ', ' de<br>')}</div></div>`
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
})
for (const b of BANNERS) {
  const page = await browser.newPage({ viewport: { width: b.width, height: b.height } })
  await page.setContent(bannerHtml(b.width, b.height))
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(out, b.file), type: 'png' })
  await page.close()
  console.log(`social/${b.file} ${b.width}×${b.height}`)
}
await browser.close()

/** Square pictures: the platform crops them. The mark sits at 52 % of the side, well inside any circle. */
async function avatar(size: number, variant: (typeof AVATAR_VARIANTS)[number]) {
  const inner = Math.round(size * 0.52)
  const art = await sharp(Buffer.from(variant === 'art' ? markHalo : markPlain), { density: 600 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const base =
    variant === 'art'
      ? sharp(Buffer.from(ribbons(SEED + 7, size, size)))
      : sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
  return base
    .composite([{ input: art, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}
for (const a of AVATARS)
  for (const v of AVATAR_VARIANTS) {
    const file = `${a.file}-${v}.png`
    await sharp(await avatar(a.size, v)).toFile(join(out, file))
    console.log(`social/${file} ${a.size}×${a.size}`)
  }
