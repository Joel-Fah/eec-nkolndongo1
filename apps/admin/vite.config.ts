import { adminBase } from '@eec/core'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { envLocal } from '../../scripts/env-local.ts'

// The admin lives under ADMIN_PATH (default /admin/) on the single origin (decisions 0017, 0025).
export default defineConfig({
  base: adminBase(envLocal('ADMIN_PATH')),
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
})
