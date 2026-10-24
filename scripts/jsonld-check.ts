/**
 * `node scripts/jsonld-check.ts <base url>` — reads the structured data (JSON-LD) of the main pages of a running site and
 * checks what Google's Rich Results Test requires for each type (Church, NewsArticle, Event, BreadcrumbList), plus the
 * share tags and the sitemap. A local first pass: the real validation is Google's Rich Results Test on the production URLs
 * (docs/ops/launch.md). Prints problems; exit code 1 if any.
 */
const base = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '')
let problems = 0
const bad = (where: string, what: string) => {
  problems++
  console.log(`✗ ${where}: ${what}`)
}
const ok = (where: string, what: string) => console.log(`✓ ${where}: ${what}`)

type Node = Record<string, unknown>
const need: Record<string, string[]> = {
  Church: ['name', 'url'],
  NewsArticle: ['headline', 'datePublished', 'image'],
  Event: ['name', 'startDate', 'location'],
  BreadcrumbList: ['itemListElement'],
}

async function page(path: string) {
  const res = await fetch(base + path)
  const html = await res.text()
  const nodes: Node[] = []
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    const j = JSON.parse(m[1] ?? 'null') as Node
    if (j['@context'] !== 'https://schema.org') bad(path, 'missing @context https://schema.org')
    nodes.push(...((j['@graph'] as Node[]) ?? [j]))
  }
  return { status: res.status, html, nodes }
}

function check(path: string, nodes: Node[], html: string, expect: string[]) {
  for (const type of expect) {
    const n = nodes.find((x) => x['@type'] === type)
    if (!n) {
      bad(path, `no ${type} block`)
      continue
    }
    const missing = (need[type] ?? []).filter((k) => n[k] === undefined || n[k] === '')
    if (missing.length) bad(path, `${type} lacks ${missing.join(', ')}`)
    else ok(path, `${type} has ${need[type]?.join(', ')}`)
  }
  for (const tag of ['og:title', 'og:image', 'og:url', 'og:type'])
    if (!html.includes(`property="${tag}"`)) bad(path, `missing ${tag}`)
  if (!html.includes('name="twitter:card"')) bad(path, 'missing twitter:card')
}

const home = await page('/fr/')
check('/fr/', home.nodes, home.html, ['Church'])

const list = (await (await fetch(`${base}/api/news/public?locale=fr&limit=1`)).json()) as {
  items?: { slug: string }[]
}
const slug = list.items?.[0]?.slug
if (slug) {
  const p = `/fr/actualites/nouvelles/${slug}/`
  const r = await page(p)
  check(p, r.nodes, r.html, ['NewsArticle', 'BreadcrumbList'])
} else console.log('· no published news item: NewsArticle not checked')

const today = new Date().toISOString().slice(0, 10)
const ev = (await (
  await fetch(
    `${base}/api/events/public?locale=fr&from=${today}&to=${new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)}`,
  )
).json()) as { items?: { slug: string; location: string }[] }
const withPlace = ev.items?.find((e) => e.location)
if (withPlace) {
  const p = `/fr/agenda/evenements/${withPlace.slug}/`
  const r = await page(p)
  check(p, r.nodes, r.html, ['Event', 'BreadcrumbList'])
} else console.log('· no upcoming event with a location: Event not checked')

const sm = await (await fetch(`${base}/sitemap.xml`)).text()
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].length
locs > 20 ? ok('/sitemap.xml', `${locs} addresses`) : bad('/sitemap.xml', `only ${locs} addresses`)
const robots = await (await fetch(`${base}/robots.txt`)).text()
console.log(
  `· robots.txt says: ${robots.split('\n')[0]}${robots.includes('Sitemap') ? ' (+ sitemap)' : ''}`,
)
console.log(problems ? `\n${problems} problem(s)` : '\nall good')
process.exit(problems ? 1 : 0)
