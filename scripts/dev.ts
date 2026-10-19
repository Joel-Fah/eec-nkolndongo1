/** `pnpm dev`: refresh .dev.vars, then run the gateway, the site (Astro + Worker) and the admin together. */
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'

// Ports must be free first: a leftover server from an earlier run would otherwise make one app fail.
const ports = { 8080: 'gateway', 4321: 'site', 5173: 'admin' } as const
const busy: string[] = []
for (const [port, name] of Object.entries(ports)) {
  const free = await new Promise<boolean>((resolve) => {
    const probe = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(Number(port))
  })
  if (!free) busy.push(`${port} (${name})`)
}
if (busy.length) {
  console.error(
    `\nPorts already in use: ${busy.join(', ')}. A previous dev server is still running.`,
  )
  console.error('Free them with:  pnpm dev:stop   (or: fuser -k 8080/tcp 4321/tcp 5173/tcp)\n')
  process.exit(1)
}

const sync = spawnSync('pnpm', ['--filter', '@eec/scripts', 'dev:vars'], { stdio: 'inherit' })
if (sync.status !== 0) process.exit(sync.status ?? 1)

const procs = [
  { name: 'gateway', color: '36', args: ['--filter', '@eec/scripts', 'dev:gateway'] },
  { name: 'site   ', color: '32', args: ['--filter', '@eec/web', 'dev'] },
  { name: 'admin  ', color: '35', args: ['--filter', '@eec/admin', 'dev'] },
].map(({ name, color, args }) => {
  const child = spawn('pnpm', args, {
    // Own process group: stopping kills the whole tree (pnpm → sh → node), not just pnpm.
    detached: true,
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
    // Astro may detach its dev server (background mode) and exit 0: that is not a failure.
    if (name.trim() === 'site' && code === 0) return
    console.log(`${name} exited (${code}). Stopping the others.`)
    stop()
  })
  return child
})

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  spawnSync('pnpm', ['--filter', '@eec/web', 'exec', 'astro', 'dev', 'stop'], { stdio: 'ignore' })
  for (const p of procs) {
    try {
      if (p.pid) process.kill(-p.pid, 'SIGTERM')
    } catch {
      // already gone
    }
  }
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
console.log('\nOpen http://localhost:8080  (site)  ·  http://localhost:8080/admin/  (admin)\n')
