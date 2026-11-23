import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { App } from './App';
import { SettingsProvider } from './lib/settings';
import { I18nProvider } from './lib/i18n';
import { AuthProvider } from './lib/auth';
import { APP_NAME } from './lib/config';
import { registerServiceWorker } from './lib/pwa';

document.title = APP_NAME;

const container = document.getElementById('root');
if (!container) throw new Error('Root element was not found.');

createRoot(container).render(
  <SettingsProvider>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </SettingsProvider>,
);

registerServiceWorker();
