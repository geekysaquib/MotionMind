import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Navigate, useLocation } from 'react-router-dom';
import { useStores } from '../stores/RootStore';
import { Spinner } from '../components/ui';

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Signed-in users only. Sends others to /login and remembers where they were going. */
export const RequireAuth = observer(function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useStores();
  const loc = useLocation();
  if (!auth.ready) return <FullScreenSpinner />;
  if (!auth.isSignedIn) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
});

/** Signed-in users who have picked a handle. */
export const RequireOnboarded = observer(function RequireOnboarded({ children }: { children: ReactNode }) {
  const { profile } = useStores();
  if (!profile.profile) return profile.error ? <div className="p-10 text-danger">{profile.error}</div> : <FullScreenSpinner />;
  if (profile.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
});

/** Auth pages bounce signed-in users into the app. */
export const GuestOnly = observer(function GuestOnly({ children }: { children: ReactNode }) {
  const { auth } = useStores();
  const loc = useLocation();
  if (!auth.ready) return <FullScreenSpinner />;
  if (auth.isSignedIn) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/app'} replace />;
  }
  return <>{children}</>;
});
