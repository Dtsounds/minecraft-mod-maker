import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Register the service worker, which is what makes the app installable and
 * lets it open with no network at all.
 *
 * Production only. In dev a service worker caches the very files Vite is busy
 * hot-reloading, which produces changes that mysteriously fail to appear.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Failure here costs offline support and nothing else, so it stays quiet.
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
