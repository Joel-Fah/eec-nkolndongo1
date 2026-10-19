import { createApp } from './app.ts'
import type { Env } from './env.ts'

const app = createApp()

export { app }
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
} satisfies ExportedHandler<Env>
