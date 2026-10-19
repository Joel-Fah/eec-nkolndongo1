/** Worker bindings and secrets. Locally these come from `.dev.vars` / the environment. */
export type Env = {
  /** Production: Cloudflare Hyperdrive in front of Neon (pooling + latency). */
  HYPERDRIVE?: { connectionString: string }
  /** Local/dev and CLI: the direct (non-pooled) Neon URL. */
  DATABASE_URL_UNPOOLED?: string
  AUTH_SECRET: string
  /** The single origin (decision 0017), e.g. https://eec-nkolndongo1.workers.dev */
  APP_ORIGIN: string
}

export const dbUrl = (env: Env): string => {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL_UNPOOLED
  if (!url) throw new Error('No database configured (HYPERDRIVE or DATABASE_URL_UNPOOLED)')
  return url
}
