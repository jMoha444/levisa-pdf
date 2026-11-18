import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
// Only the production application shell is cached. No runtime document cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then(async () => {
      await navigator.serviceWorker.ready;
      window.dispatchEvent(new Event('levisa-offline-ready'));
    }).catch(() => { /* App remains usable online if the browser refuses offline storage. */ });
  });
}
