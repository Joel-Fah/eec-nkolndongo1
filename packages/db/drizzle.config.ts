import { defineConfig } from 'drizzle-kit'

// Migrations are generated from here and applied with the DIRECT connection (never `push` on production).
export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/schema/index.ts', '../../modules/*/src/schema.ts'],
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? '' },
})
