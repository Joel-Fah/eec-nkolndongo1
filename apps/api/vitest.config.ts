import { defineConfig } from 'vitest/config'

// Integration tests talk to Neon over the internet from a laptop: be generous.
export default defineConfig({ test: { testTimeout: 90_000, hookTimeout: 90_000 } })
