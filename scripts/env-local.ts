/** Reads a variable from the environment, else from the gitignored root .env.local (never logs values). */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')

export function envLocal(name: string): string | undefined {
  if (process.env[name] !== undefined) return process.env[name]
  if (!existsSync(file)) return undefined
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.startsWith(`${name}=`)) continue
    return t
      .slice(name.length + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return undefined
}
