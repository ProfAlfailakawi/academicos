import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppPreferencesProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './lib/i18n';
import './index.css';
import './styles/identity.css';
import './components/dna/dna-theme.css';
import './motion.css';
import './final-polish.css';
import './duo.css';
import './beauty.css';
import './duo-edges.css';
import './duo-device.css';
import { installAppUpdate } from './lib/app-update';
import { installDuoMarkers } from './lib/duo-markers';
import { installDockMotion } from './lib/dockMotion';
import './styles/dock-motion.css';

declare global {
  interface Window { __acosBootReady?: () => void }
}

// علامات iPhone Duo (data-device / data-shell / data-widget-side) قبل أول رسم.
installDuoMarkers();

// تشخيص ركن الودجت: يُحمَّل فقط مع ?duo-debug=1.
if (new URLSearchParams(location.search).get('duo-debug') === '1') {
  void import('./duo-debug').then((m) => requestAnimationFrame(m.mountDuoDebug));
}

// التحديث الذاتي الصامت: بصمة الإصدار، منارتها، ثم التحديث والتصعيد عند اللزوم.
installAppUpdate();

if ('serviceWorker' in navigator && import.meta.env.PROD) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined)); }

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><I18nProvider><AppPreferencesProvider><AuthProvider><App/></AuthProvider></AppPreferencesProvider></I18nProvider></ErrorBoundary></StrictMode>);

// تسليم الشاشة إلى React بعد أول رسم. المؤقّت احتياطٌ للتبويب المخفي
// حيث لا يعمل requestAnimationFrame؛ والاستدعاء آمن للتكرار.
// حركة شريط التنقّل (بصرية فقط): الشريط السفلي وكبسولة الدوو، وعمود التنقّل على الدوو وحده.
installDockMotion({ dock: '.mobile-dock', link: '.mobile-nav-link', active: '.mobile-nav-link[aria-current="page"]' });
if (document.documentElement.dataset.device === 'duo') {
  installDockMotion({ dock: '.app-sidebar--desktop nav', link: '.sidebar-nav-link', active: '.sidebar-nav-link[aria-current="page"]' });
}

const handOff = () => window.__acosBootReady?.();
requestAnimationFrame(() => requestAnimationFrame(handOff));
setTimeout(handOff, 400);
