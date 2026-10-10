import 'bootstrap/dist/css/bootstrap.min.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeTheme } from './core/theme/theme.service'

async function startApplication() {
  try {
    await initializeTheme()

    const rootElement = document.getElementById('root')

    if (!rootElement) {
      throw new Error('No se encontró el elemento #root')
    }

    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (error) {
    console.error('No se pudo iniciar la aplicación:', error)
  }
}

void startApplication()
