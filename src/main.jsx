import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const isMobileWebEntry = ['http:', 'https:'].includes(window.location.protocol)
  && window.location.pathname.replace(/\/$/, '').endsWith('/mobile')

if (isMobileWebEntry && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/pwa-sw.js', { scope: '/mobile' })
    .catch(error => console.warn('Mobile app shell service worker registration failed', error))
}

createRoot(document.getElementById('root')).render(
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
)
