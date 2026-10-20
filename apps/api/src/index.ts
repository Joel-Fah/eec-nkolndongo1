import type { Env } from '@eec/api-kit'
import { createApp } from './app.ts'

const app = createApp()

export { app }
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
} satisfies ExportedHandler<Env>
