import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The built interface is served by FastAPI under /app, hence base: '/app/'.
// In development, Vite serves it at http://localhost:5173/app/ and proxies
// the API routes to FastAPI (override with VITE_API_TARGET if needed).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const target = env.VITE_API_TARGET || 'http://127.0.0.1:8000'

  return {
    base: '/app/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/shipments': target,
        '/stats': target,
        '/health': target,
        '/auth': target,
      },
    },
    build: { outDir: 'dist' },
  }
})
