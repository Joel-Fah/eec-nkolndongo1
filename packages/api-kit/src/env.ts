/** Worker bindings and secrets. Locally these come from `.dev.vars` / the environment. */
export type Env = {
  /** Production: Cloudflare Hyperdrive in front of Neon (pooling + latency). */
  HYPERDRIVE?: { connectionString: string }
  /** Local/dev and CLI: the direct (non-pooled) Neon URL. */
  DATABASE_URL_UNPOOLED?: string
  AUTH_SECRET: string
  /** Where the admin lives (default « admin »); « admin », « admin/ » and « /admin/ » are all accepted. */
  ADMIN_PATH?: string
  /** Google sign-in for members (OAuth client created by Joël). Both absent = Google stays inactive. */
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** Object storage for the media library (S3-compatible: Neon today, R2 later; decision 0020). */
  AWS_ENDPOINT_URL_S3?: string
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  AWS_REGION?: string
  /** Defaults to « eec-media ». */
  MEDIA_BUCKET?: string
  /** Pexels API key: the admin's stock-photo search (the live site never calls Pexels). Secret. */
  PEXELS_API_KEY?: string
  /** « 1 » once the site is launched: until then every page asks search engines to stay away. */
  SITE_INDEXABLE?: string
  /**
   * Visit counts without tracking (decision 0038): a Workers Analytics Engine dataset. Absent = no counting, nothing else
   * changes. Added to the built Worker only when Joël has enabled Analytics Engine in the Cloudflare dashboard.
   */
  VISITS?: {
    writeDataPoint: (point: { indexes?: string[]; blobs?: string[]; doubles?: number[] }) => void
  }
  /** To read the counts back in the admin: the account id and an API token with « Account Analytics: Read ». */
  CF_ACCOUNT_ID?: string
  /** The dataset's name, to query it. */
  VISITS_DATASET?: string
  CF_ANALYTICS_TOKEN?: string
  /** The single origin (decision 0017), e.g. https://eec-nkolndongo1.workers.dev */
  APP_ORIGIN: string
}

export const dbUrl = (env: Env): string => {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL_UNPOOLED
  if (!url) throw new Error('No database configured (HYPERDRIVE or DATABASE_URL_UNPOOLED)')
  return url
}
