import { Link } from 'react-router-dom';
import { LogoMark } from '../components/Logo';

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <LogoMark className="h-16 w-16 opacity-80" />
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <Link to="/app" className="text-sm font-semibold text-accent hover:underline">
        Go to the dashboard
      </Link>
    </div>
  );
}
