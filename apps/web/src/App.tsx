import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { GuestOnly, RequireAuth, RequireOnboarded } from './layout/guards';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';
import { DashboardPage } from './pages/app/DashboardPage';
import { DiscoverPage } from './pages/app/DiscoverPage';
import { LibraryPage } from './pages/app/LibraryPage';
import { ProjectLayout } from './pages/app/ProjectLayout';
import { ProjectOverviewPage } from './pages/app/ProjectOverviewPage';
import { StagePage } from './pages/app/StagePage';
import { SettingsPage } from './pages/app/SettingsPage';
import { ProfileSettings } from './pages/app/ProfileSettings';
import { KeysSettings } from './pages/app/KeysSettings';
import { AccountSettings } from './pages/app/AccountSettings';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { Toasts } from './components/Toasts';

const stage = (s: Parameters<typeof StagePage>[0]['stage']) => ({ path: s, element: <StagePage stage={s} /> });

export const routes = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: '/signup', element: <GuestOnly><SignupPage /></GuestOnly> },
  { path: '/forgot-password', element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/onboarding', element: <RequireAuth><OnboardingPage /></RequireAuth> },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <RequireOnboarded>
          <AppShell />
        </RequireOnboarded>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'library', element: <LibraryPage /> },
      {
        path: 'projects/:id',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          stage('research'),
          stage('script'),
          stage('storyboard'),
          stage('graphics'),
          stage('voice'),
          stage('editor'),
          stage('export'),
        ],
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        children: [
          { index: true, element: <ProfileSettings /> },
          { path: 'keys', element: <KeysSettings /> },
          { path: 'account', element: <AccountSettings /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

const router = createBrowserRouter(routes);

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toasts />
    </>
  );
}
