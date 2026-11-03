import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/google-sans';
import './index.css';
import { App } from './App';
import { configProblems } from './config';
import { RootStore, StoreContext } from './stores/RootStore';

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  const problems = configProblems();
  if (problems.length) {
    root.render(
      <div className="mx-auto max-w-lg p-10 text-sm">
        <h1 className="font-display text-2xl font-bold">Motion Mind isn't configured yet</h1>
        <ul className="mt-4 list-disc pl-5 text-danger">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-4 text-ink-400">Copy apps/web/.env.example to apps/web/.env.local and fill it in, or set VITE_DATA_MODE=memory for a local demo.</p>
      </div>,
    );
    return;
  }
  const { config } = await import('./config');
  const services = config.dataMode === 'memory' ? (await import('./services/memory')).memoryServices() : (await import('./services/supabase')).supabaseServices();
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
