/**
 * `pnpm --filter @eec/scripts social:kit` — the social media kit of the brand guide: cover banners (Facebook, X, YouTube) drawn
 * from the abstract banner, and round-ready profile pictures (Facebook, X, Instagram, YouTube, WhatsApp) from the mark, into
 * apps/web/public/brand/social/. Run by hand when the brand changes and commit the result (nothing is generated at runtime).
 * The mark is never altered: only placed, with its clear space (28 % of its height). Banners carry the mark and the parish name,
 * nothing else (no tagline, no handle, no claim). Needs `playwright-core` + Chrome (see og-generate.ts), the fonts
 * (`pnpm fonts:fetch`) and `sharp`.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import sharp from 'sharp'
import { AVATAR_VARIANTS, AVATARS, BANNERS } from '../apps/web/src/lib/social-kit.ts'
import { abstractArt } from '../packages/ui/src/abstract-art.ts'

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

// The light theme's tokens as hex (packages/ui/tokens.css), because a PNG has no CSS variables.
const COLORS = {
  primary: '#1F5C3A',
  info: '#1F5FA8',
  gold: '#E8B931',
  clay: '#D9643A',
  success: '#1B6E3F',
  surface: '#FFFFFF',
}
const SEED = 20261025
const mark = brand('mark.svg')

/** A banner: the abstract art, then the mark and the parish name side by side, centred in the safe box. */
const bannerHtml = (w: number, h: number, safeW: number, safeH: number) => {
  const markH = Math.round(safeH * 0.92)
  const markW = Math.round(markH * (850 / 826))
  const title = Math.round(safeH * 0.27)
  const sub = Math.round(safeH * 0.12)
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Erode;src:url(${font('erode/Erode-Variable.woff2')}) format('woff2');font-weight:300 700}
@font-face{font-family:Switzer;src:url(${font('switzer/Switzer-Variable.woff2')}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:${w}px;height:${h}px;background:#FBF8F1;position:relative;overflow:hidden;font-family:Switzer,sans-serif;color:#16201A}
svg.art{position:absolute;inset:0}
.safe{position:absolute;left:50%;top:50%;width:${safeW}px;height:${safeH}px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;gap:${Math.round(safeH * 0.12)}px}
.mark{width:${markW}px;height:${markH}px;flex:none;filter:drop-shadow(0 ${Math.round(safeH * 0.015)}px 0 rgba(0,0,0,.16))}
.mark svg{width:100%;height:100%}
.copy{display:grid;gap:${Math.round(safeH * 0.05)}px}
.name{font-family:Erode,serif;font-weight:500;font-size:${title}px;line-height:1.02;letter-spacing:-.015em}
.church{font-size:${sub}px;font-weight:600;color:#1F5C3A}
</style>
<svg class="art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${abstractArt({ seed: SEED, width: w, height: h, colors: COLORS, tone: 'primary' })}</svg>
<div class="safe"><div class="mark">${mark}</div><div class="copy"><p class="church">${fr.site.church}</p><h1 class="name">${fr.site.parish}</h1></div></div>`
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
})
for (const b of BANNERS) {
  const page = await browser.newPage({ viewport: { width: b.width, height: b.height } })
  await page.setContent(bannerHtml(b.width, b.height, b.safe.width, b.safe.height))
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(out, b.file), type: 'png' })
  await page.close()
  console.log(`social/${b.file} ${b.width}×${b.height}`)
}
await browser.close()

/** A square avatar: the mark centred at 66 % of the side, so a circular crop (inscribed 70 %) never touches it. */
async function avatar(size: number, variant: (typeof AVATAR_VARIANTS)[number]) {
  const svg = variant === 'green' ? brand('mark-halo.svg') : mark
  const inner = Math.round(size * 0.66)
  const art = await sharp(Buffer.from(svg), { density: 600 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: variant === 'green' ? '#1F5C3A' : '#FBF8F1',
    },
  })
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
