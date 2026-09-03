import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppPreferencesProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './lib/i18n';
import './index.css';

declare global {
  interface Window { __acosBootReady?: () => void }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined)); }

createRoot(document.getElementById('root')!).render(<StrictMode><I18nProvider><AppPreferencesProvider><AuthProvider><App/></AuthProvider></AppPreferencesProvider></I18nProvider></StrictMode>);

// تُسلَّم الشاشة إلى React بعد أول رسم فعلي، فلا يظهر أي وميض بين الاثنين.
// requestAnimationFrame لا يعمل في تبويب مخفي، لذا نضيف مؤقتًا احتياطيًا:
// الاستدعاء آمن للتكرار، وAppSplash يطابق شاشة الإقلاع بصريًا فلا يظهر أي قطع.
const handOff = () => window.__acosBootReady?.();
requestAnimationFrame(() => requestAnimationFrame(handOff));
setTimeout(handOff, 400);
