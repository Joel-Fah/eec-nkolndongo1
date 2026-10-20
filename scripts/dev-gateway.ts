/**
 * Local single origin (decision 0017): one URL (http://localhost:8080) in front of
 *   <ADMIN_PATH>/* (default /admin/) → Vite admin dev server (:5173, same base)
 *   anything else (site, /api, /media) → the Astro + Worker dev server (:4321)
 * Mirrors production, where one Worker serves all three. No dependencies; forwards WebSocket (HMR).
 */
import { createServer, request } from 'node:http'
import { connect } from 'node:net'
import { adminPrefix } from '../packages/core/src/admin-path.ts'
import { envLocal } from './env-local.ts'

const PORT = Number(process.env.GATEWAY_PORT ?? 8080)
const ADMIN = { host: '127.0.0.1', port: 5173 }
const SITE = { host: '127.0.0.1', port: 4321 }
const PREFIX = adminPrefix(envLocal('ADMIN_PATH'))
const pick = (url = '/') => (url === PREFIX || url.startsWith(`${PREFIX}/`) ? ADMIN : SITE)

const server = createServer((req, res) => {
  const target = pick(req.url)
  const upstream = request(
    {
      ...target,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${PORT}`,
        'x-forwarded-host': `localhost:${PORT}`,
      },
    },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers)
      r.pipe(res)
    },
  )
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Le serveur de développement ne répond pas encore. / The dev server is not up yet.')
  })
  req.pipe(upstream)
})

server.on('upgrade', (req, socket, head) => {
  const target = pick(req.url)
  const upstream = connect(target.port, target.host, () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n')}\r\n\r\n`,
    )
    upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
})

server.listen(PORT, () =>
  console.log(`Single origin ready: http://localhost:${PORT}  (/admin → :5173, rest → :4321)`),
)
