import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializePlatform } from '@platform'
import './index.css'

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Resolve the platform's real capabilities (secure storage, credential proxy)
// before the first render so nothing reads them while they are still defaults.
initializePlatform()
  .catch((error) => console.error('[Platform] Initialization failed:', error))
  .finally(render)
