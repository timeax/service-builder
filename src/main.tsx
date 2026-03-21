import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// Temporary mitigation for React Flow update-depth issues in dev until full @xyflow/react migration is complete.
const isDev = import.meta.env.DEV

createRoot(document.getElementById('root')!).render(
  isDev ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
