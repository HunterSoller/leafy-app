import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api = (env.VITE_API_URL || '').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: api
      ? {
          proxy: {
            '/api': {
              target: api,
              changeOrigin: true,
            },
          },
        }
      : {},
  }
})
