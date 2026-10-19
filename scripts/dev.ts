/** `pnpm dev`: refresh .dev.vars, then run the gateway, the site (Astro + Worker) and the admin together. */
import { spawn, spawnSync } from 'node:child_process'

const sync = spawnSync('pnpm', ['--filter', '@eec/scripts', 'dev:vars'], { stdio: 'inherit' })
if (sync.status !== 0) process.exit(sync.status ?? 1)

const procs = [
  { name: 'gateway', color: '36', args: ['--filter', '@eec/scripts', 'dev:gateway'] },
  { name: 'site   ', color: '32', args: ['--filter', '@eec/web', 'dev'] },
  { name: 'admin  ', color: '35', args: ['--filter', '@eec/admin', 'dev'] },
].map(({ name, color, args }) => {
  const child = spawn('pnpm', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  const out = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n'))
      if (line.trim()) stream.write(`\x1b[${color}m${name}\x1b[0m │ ${line}\n`)
  }
  child.stdout.on('data', out(process.stdout))
  child.stderr.on('data', out(process.stderr))
  child.on('exit', (code) => {
    console.log(`${name} exited (${code}). Stopping the others.`)
    stop()
  })
  return child
})

function stop() {
  for (const p of procs) if (!p.killed) p.kill('SIGTERM')
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
console.log('\nOpen http://localhost:8080  (site)  ·  http://localhost:8080/admin/  (admin)\n')
