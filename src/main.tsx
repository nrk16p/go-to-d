import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible-next/latin-400.css'
import '@fontsource/atkinson-hyperlegible-next/latin-700.css'
import './ui/theme.css'
import App from './App.tsx'
import { appEngine } from './ui/engine'
import { warmEngineCache } from './ui/warmCache'

// The engine starts loading now, before the first screen draws; drills on the book don't wait for it.
const engine = appEngine()
warmEngineCache(engine)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App engine={engine} />
  </StrictMode>,
)
