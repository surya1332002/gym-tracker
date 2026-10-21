import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './auth/AuthGate.tsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './app/ThemeProvider'
import AppErrorBoundary from './app/AppErrorBoundary'
import { NativeRuntime } from './native/NativeLaunchGate'
import { isNativeAndroid } from './native/runtime'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><ThemeProvider><BrowserRouter><NativeRuntime><AuthGate /></NativeRuntime></BrowserRouter></ThemeProvider></AppErrorBoundary>
  </StrictMode>,
)
if (import.meta.env.PROD && !isNativeAndroid() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
