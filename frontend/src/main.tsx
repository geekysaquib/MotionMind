import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/google-sans';
import './index.css';
import { App } from './App';
import { config } from './config';
import { RootStore, StoreContext } from './stores/RootStore';

async function boot() {
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
