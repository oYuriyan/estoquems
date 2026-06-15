import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { AppProvider } from './contexts/AppContext'
import { UIProvider }  from './contexts/UIContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'

// Inicializa Sentry antes de qualquer render
// (captura erros de inicialização da própria app)
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)
