import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppPreferencesProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './lib/i18n';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined)); }

createRoot(document.getElementById('root')!).render(<StrictMode><I18nProvider><AppPreferencesProvider><AuthProvider><App/></AuthProvider></AppPreferencesProvider></I18nProvider></StrictMode>);
