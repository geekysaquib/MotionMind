import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/google-sans';
import './index.css';
import { App } from './App';
import { config } from './config';
import { log, type LogEntry } from './lib/logger';
import { RootStore, StoreContext } from './stores/RootStore';

/** Warnings and errors also go to the API, so they appear in the server log (Netlify function logs). */
function reportToServer(entries: LogEntry[]) {
  void fetch(`${config.apiUrl}/api/client-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries, page: location.pathname, userAgent: navigator.userAgent }),
    keepalive: true,
  }).catch(() => {
    /* offline or API down: the entries are still in the local log */
  });
}

function installGlobalLogging() {
  log.setReporter(reportToServer);
  window.addEventListener('error', (e) => log.error('window', `Uncaught error: ${e.message}`, { err: e.error, source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => log.error('window', `Unhandled promise rejection: ${String((e.reason as Error)?.message ?? e.reason)}`, { err: e.reason }));
  window.addEventListener('pagehide', () => log.flush());
}

async function boot() {
  installGlobalLogging();
  log.info('app', `Started in ${config.dataMode} mode`, { page: location.pathname });
  const root = createRoot(document.getElementById('root')!);
  const services = config.dataMode === 'memory' ? (await import('./services/memory')).memoryServices() : (await import('./services/api')).apiServices();
  const store = new RootStore(services);
  void store.auth.init();
  root.render(
    <StrictMode>
      <StoreContext.Provider value={store}>
        <App />
      </StoreContext.Provider>
    </StrictMode>,
  );
}

void boot();
