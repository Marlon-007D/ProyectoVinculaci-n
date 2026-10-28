import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages sirve desde /<repositorio>/; Vercel y el desarrollo usan la raíz.
const base = process.env.GITHUB_ACTIONS === 'true'
  ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}/`
  : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true
  }
})
