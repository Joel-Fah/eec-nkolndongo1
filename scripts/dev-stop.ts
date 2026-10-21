/** `pnpm dev:stop`: frees the dev ports (gateway 8080, site 4321, admin 5173) left by an earlier run. */
import { spawnSync } from 'node:child_process'

spawnSync('pnpm', ['--filter', '@eec/web', 'exec', 'astro', 'dev', 'stop'], { stdio: 'ignore' })
const r = spawnSync('fuser', ['-k', '8080/tcp', '4321/tcp', '5173/tcp'], { encoding: 'utf8' })
console.log(r.stderr.trim() ? `Stopped: ${r.stderr.trim()}` : 'Nothing was running.')
