import { useStores } from '../stores/RootStore';

export function DemoBanner() {
  const { services } = useStores();
  if (services.mode !== 'memory') return null;
  return (
    <div className="bg-amber-400/15 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      Demo mode: accounts and projects are stored only in this browser, not on the server. Set VITE_DATA_MODE=api for real data.
    </div>
  );
}
