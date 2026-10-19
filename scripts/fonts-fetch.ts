/**
 * Downloads the Fontshare fonts we self-host into packages/ui/fonts/fontshare/ (gitignored).
 *
 * Why not commit them? The ITF Free Font License (Fontshare) allows self-hosting on our own site but
 * forbids redistributing the files through a repository, and forbids subsetting or converting them.
 * So every developer and CI run fetches the official WOFF2s directly from Fontshare, unmodified.
 *
 * Usage: pnpm fonts:fetch [--force]
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const families: Record<string, string[]> = {
  switzer: ['Variable', 'VariableItalic', 'Regular', 'Italic', 'Medium', 'Semibold'],
  erode: ['Variable', 'VariableItalic'],
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'packages/ui/fonts/fontshare')
const force = process.argv.includes('--force')

/** Minimal ZIP reader (stored + deflate entries), enough for Fontshare archives. */
function readZip(buffer: Buffer): Map<string, () => Buffer> {
  const entries = new Map<string, () => Buffer>()
  let eocd = buffer.length - 22
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('Not a zip archive')
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeader = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    entries.set(name, () => {
      const localName = buffer.readUInt16LE(localHeader + 26)
      const localExtra = buffer.readUInt16LE(localHeader + 28)
      const start = localHeader + 30 + localName + localExtra
      const data = buffer.subarray(start, start + compressedSize)
      if (method === 0) return Buffer.from(data)
      if (method === 8) return inflateRawSync(data)
      throw new Error(`Unsupported zip method ${method} for ${name}`)
    })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function fetchFamily(family: string, styles: string[]): Promise<void> {
  const dir = join(outDir, family)
  // File prefix: `general-sans` → `GeneralSans`
  const Family = family
    .split('-')
    .map((w) => (w[0]?.toUpperCase() ?? '') + w.slice(1))
    .join('')
  const wanted = styles.map((style) => `${Family}-${style}.woff2`)
  if (!force && wanted.every((file) => existsSync(join(dir, file)))) {
    console.log(`✓ ${Family} already present`)
    return
  }

  const url = `https://api.fontshare.com/v2/fonts/download/${family}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  const zip = readZip(Buffer.from(await response.arrayBuffer()))

  await mkdir(dir, { recursive: true })
  for (const file of wanted) {
    const entry = [...zip.keys()].find((name) => name.endsWith(`/WEB/fonts/${file}`))
    if (!entry) throw new Error(`${file} missing from the ${Family} archive`)
    await writeFile(join(dir, file), zip.get(entry)?.() ?? Buffer.alloc(0))
  }
  const licence = [...zip.keys()].find((name) => /\/License\/.*\.txt$/i.test(name))
  if (licence) await writeFile(join(dir, 'LICENSE.txt'), zip.get(licence)?.() ?? '')
  console.log(`↓ ${Family}: ${wanted.length} files`)
}

try {
  for (const [family, styles] of Object.entries(families)) await fetchFamily(family, styles)
} catch (error) {
  console.error(`\nCould not fetch fonts from Fontshare: ${(error as Error).message}`)
  console.error('The site falls back to system fonts until `pnpm fonts:fetch` succeeds.')
  process.exit(1)
}
