/**
 * `node scripts/og-generate.ts` — the default share images (Open Graph), one per page type and language, drawn from the
 * brand only: the mark, the parish name, a title in Erode, our colours. 1200×630 JPEG into apps/web/public/og/. Run by hand
 * when the brand texts change and commit the result (no image service at runtime, nothing generated on the Worker). No
 * illustration, no photo, no claim about the parish: only names that are already on every page.
 * Needs a browser to draw text with the real fonts: `playwright-core` (resolved from node_modules or scripts/.cache/pw)
 * and Chrome (CHROME_PATH, default /usr/bin/google-chrome), and the fonts (`pnpm fonts:fetch`).
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const require = createRequire(join(root, 'scripts/.cache/pw/'))
const { chromium } = (() => {
  try {
    return require('playwright-core') as typeof import('playwright-core')
  } catch {
    return createRequire(import.meta.url)('playwright-core') as typeof import('playwright-core')
  }
})()

const fr = JSON.parse(readFileSync(join(root, 'packages/i18n/messages/fr.json'), 'utf8'))
const en = JSON.parse(readFileSync(join(root, 'packages/i18n/messages/en.json'), 'utf8'))
const msgs = { fr, en } as const
const mark = readFileSync(join(root, 'apps/web/public/mark.svg'), 'utf8')
const font = (f: string) =>
  `data:font/woff2;base64,${readFileSync(join(root, 'packages/ui/fonts/fontshare', f)).toString('base64')}`
const erode = font('erode/Erode-Variable.woff2')
const switzer = font('switzer/Switzer-Variable.woff2')

const TYPES = ['default', 'discover', 'live', 'calendar', 'news', 'give'] as const
const out = join(root, 'apps/web/public/og')
mkdirSync(out, { recursive: true })

const html = (
  title: string,
  kicker: string,
  line: string,
) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Erode;src:url(${erode}) format('woff2');font-weight:300 700}
@font-face{font-family:Switzer;src:url(${switzer}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#FBF8F1;color:#16201A;font-family:Switzer,sans-serif;position:relative;overflow:hidden}
.glow{position:absolute;right:-180px;top:-160px;width:820px;height:820px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#E8B931 0%,rgba(232,185,49,.35) 38%,rgba(31,92,58,.0) 70%)}
.disc{position:absolute;right:70px;bottom:-250px;width:560px;height:560px;border-radius:50%;background:#1F5C3A}
.mark{position:absolute;right:150px;bottom:50px;width:260px;height:250px;filter:drop-shadow(0 6px 0 rgba(0,0,0,.18))}
.mark svg{width:100%;height:100%}
.copy{position:absolute;left:80px;top:80px;bottom:80px;width:600px;display:flex;flex-direction:column;justify-content:space-between}
.kicker{font-size:28px;font-weight:600;color:#1F5C3A;letter-spacing:.01em}
h1{font-family:Erode,serif;font-weight:500;font-size:96px;line-height:1.02;letter-spacing:-.015em}
.line{font-size:30px;line-height:1.35;color:#4a554d;max-width:480px}
</style><div class="glow"></div><div class="disc"></div><div class="mark">${mark}</div>
<div class="copy"><p class="kicker">${kicker}</p><h1>${title}</h1><p class="line">${line}</p></div>`

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const locale of ['fr', 'en'] as const) {
  const m = msgs[locale]
  for (const type of TYPES) {
    const title = type === 'default' ? m.site.parish : m.nav[type]
    const kicker = type === 'default' ? m.site.church : m.site.parish
    const line = type === 'default' ? m.site.tagline : m.site.church
    await page.setContent(html(title, kicker, line))
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: join(out, `${type}-${locale}.jpg`), type: 'jpeg', quality: 82 })
    console.log(`og/${type}-${locale}.jpg`)
  }
}
await browser.close()
