/** The Worker bindings object (secrets, vars, ASSETS). Typed loosely here; consumers cast to their own shape. */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>
}
