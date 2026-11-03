import { observer } from 'mobx-react-lite';
import { Navigate } from 'react-router-dom';
import { useStores } from '../../stores/RootStore';
import { Spinner } from '../../components/ui';
import { AuthLayout } from '../../layout/AuthLayout';
import { Link } from 'react-router-dom';

/** Email confirmation and magic links land here; Supabase reads the token from the URL. */
export const AuthCallbackPage = observer(function AuthCallbackPage() {
  const { auth } = useStores();
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const err = params.get('error_description');
  if (err)
    return (
      <AuthLayout title="That link didn't work" subtitle={err}>
        <Link to="/login" className="font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  if (!auth.ready) return <div className="flex h-full items-center justify-center"><Spinner label="Signing you in" /></div>;
  return <Navigate to={auth.isSignedIn ? '/app' : '/login'} replace />;
});
