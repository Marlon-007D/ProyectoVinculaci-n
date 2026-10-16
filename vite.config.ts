import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Vercel sirve la aplicación desde la raíz del dominio.
  base: '/',
  plugins: [react()],
})
