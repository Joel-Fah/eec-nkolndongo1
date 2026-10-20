/**
 * Storyset (Cuate) illustrations, decision 0024. Their licence allows use on our site and recolouring, but
 * not redistributing the files — so, like the Fontshare fonts, only their URLs are committed
 * (packages/ui/illustrations/storyset.json). This script downloads each SVG (cached), recolours it into our
 * palette (tokens.ts → storysetPalette + skin), optimises it, and writes one file per theme into the
 * gitignored public folders of the site and the admin: /illustrations/<name>-light.svg and -dark.svg.
 *
 * Usage: pnpm illos:fetch [--force]
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { optimize } from 'svgo'
import { skin, storysetPalette } from '../packages/ui/src/tokens.ts'

type Entry = {
  name: string
  url: string
  background: boolean
  use: string
  precision?: number
  recolour?: boolean
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest: Entry[] = JSON.parse(
  await readFile(join(root, 'packages/ui/illustrations/storyset.json'), 'utf8'),
)
const cache = join(root, 'scripts/.cache/storyset/raw')
const outs = [
  join(root, 'apps/web/public/illustrations'),
  join(root, 'apps/admin/public/illustrations'),
]
const force = process.argv.includes('--force')

function hsl(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (hue * 60 + 360) % 360, s, l }
}

type Role = keyof (typeof storysetPalette)['light'] | `skin${0 | 1 | 2 | 3}` | 'keep'
/** What a Storyset colour *is* (accent, slate, grey, skin…), from its hue, saturation and lightness. */
function role(hex: string): Role {
  const { h, s, l } = hsl(hex)
  if (l < 0.03) return 'keep'
  if (l > 0.97) return 'paper'
  if (h >= 38 && h <= 58 && s > 0.55 && l > 0.35) return l < 0.5 ? 'accentDeep' : 'accent'
  if (s < 0.14)
    return l >= 0.9
      ? 'mist'
      : l >= 0.78
        ? 'mist2'
        : l >= 0.5
          ? 'mist3'
          : l >= 0.32
            ? 'slate3'
            : 'slate'
  if (h >= 180 && h <= 230 && s < 0.35) return l < 0.22 ? 'slate' : l < 0.33 ? 'slate2' : 'slate3'
  if ((h <= 32 || h >= 345) && s > 0.2 && l > 0.25 && l < 0.88) {
    if (h >= 320 || (h < 10 && l > 0.75 && s > 0.8)) return 'blush'
    return l > 0.72 ? 'skin0' : l > 0.58 ? 'skin1' : l > 0.45 ? 'skin2' : 'skin3'
  }
  if (h >= 320) return 'blush'
  return 'keep'
}

function recolour(svg: string, theme: 'light' | 'dark', unknown: Set<string>) {
  const palette = storysetPalette[theme]
  return svg.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (hex) => {
    const r = role(hex)
    if (r === 'keep') {
      unknown.add(hex)
      return hex
    }
    if (r.startsWith('skin')) return skin[Number(r.slice(4)) as 0 | 1 | 2 | 3]
    return palette[r as keyof typeof palette]
  })
}

async function get(url: string, tries = 4): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (error) {
    if (tries <= 1) throw error
    await new Promise((r) => setTimeout(r, 1500))
    return get(url, tries - 1)
  }
}

await mkdir(cache, { recursive: true })
for (const dir of outs) await mkdir(dir, { recursive: true })
try {
  for (const entry of manifest) {
    const done = outs.every((dir) => existsSync(join(dir, `${entry.name}-dark.svg`)))
    if (done && !force) {
      console.log(`✓ ${entry.name} already present`)
      continue
    }
    const rawFile = join(cache, `${entry.name}.svg`)
    // A file you downloaded yourself (assets/images, git-ignored: the licence forbids redistributing it) wins.
    const local = entry.local ? join(root, entry.local) : ''
    const raw =
      local && existsSync(local)
        ? await readFile(local, 'utf8')
        : existsSync(rawFile)
          ? await readFile(rawFile, 'utf8')
          : await get(entry.url)
    await writeFile(rawFile, raw)
    // Storyset's "background-complete" layer (plants, windows…) is dropped for small uses.
    const dropBackground = {
      name: 'dropBackground',
      fn: () => ({
        element: {
          enter: (
            node: { attributes: Record<string, string> },
            parent: { children: unknown[] },
          ) => {
            if (!entry.background && node.attributes.id === 'background-complete')
              parent.children = parent.children.filter((child) => child !== node)
          },
        },
      }),
    }
    const small = optimize(raw, {
      multipass: true,
      // Very detailed drawings (thousands of tiny shapes) can ask for fewer decimals to stay light.
      floatPrecision: entry.precision ?? 1,
      plugins: [
        dropBackground,
        'preset-default',
        'convertStyleToAttrs',
        { name: 'removeAttrs', params: { attrs: ['id', 'class', 'data-name'] } },
      ],
    }).data
    const unknown = new Set<string>()
    for (const theme of ['light', 'dark'] as const) {
      // `recolour: false` keeps the artist's own colours (error pages), the same file for both themes.
      const svg = entry.recolour === false ? small : recolour(small, theme, unknown)
      for (const dir of outs) await writeFile(join(dir, `${entry.name}-${theme}.svg`), svg)
    }
    console.log(
      `↓ ${entry.name} ${(small.length / 1024).toFixed(0)} KB (${(gzipSync(small).length / 1024).toFixed(1)} KB gz)${unknown.size ? ` · kept as is: ${[...unknown].join(' ')}` : ''}`,
    )
  }
} catch (error) {
  console.error(`\nCould not fetch Storyset illustrations: ${(error as Error).message}`)
  console.error('Pages show no illustration until `pnpm illos:fetch` succeeds.')
  process.exit(1)
}
