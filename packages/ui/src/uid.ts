let counter = 0

/** Deterministic per-build id prefix for inlined SVGs (unique within a page). */
export function nextId(prefix = 'u'): string {
  counter += 1
  return `${prefix}${counter.toString(36)}`
}
