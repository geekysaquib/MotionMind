import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { GuestOnly, RequireAuth, RequireOnboarded } from './layout/guards';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';
import { DashboardPage } from './pages/app/DashboardPage';
import { DiscoverPage } from './pages/app/DiscoverPage';
import { LibraryPage } from './pages/app/LibraryPage';
import { ProjectLayout } from './pages/app/ProjectLayout';
import { ProjectOverviewPage } from './pages/app/ProjectOverviewPage';
import { StagePage } from './pages/app/StagePage';
import { SettingsPage } from './pages/app/SettingsPage';
import { ProfileSettings } from './pages/app/ProfileSettings';
import { AccountSettings } from './pages/app/AccountSettings';
import { DiagnosticsSettings } from './pages/app/DiagnosticsSettings';
import { ConnectorsSettings } from './pages/app/ConnectorsSettings';
import { ScriptStagePage } from './pages/app/ScriptStagePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { Toasts } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { log } from './lib/logger';

const stage = (s: Parameters<typeof StagePage>[0]['stage']) => ({ path: s, element: <StagePage stage={s} /> });

export const routes = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  // Sign-up is the same email-code screen; old links still land somewhere useful.
  { path: '/signup', element: <Navigate to="/login" replace /> },
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
          { path: 'script', element: <ScriptStagePage /> },
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
          { path: 'connectors', element: <ConnectorsSettings /> },
          // Old link from before connectors existed.
          { path: 'claude', element: <Navigate to="/app/settings/connectors" replace /> },
          { path: 'account', element: <AccountSettings /> },
          { path: 'diagnostics', element: <DiagnosticsSettings /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

const router = createBrowserRouter(routes);

// Page changes go in the UI log, so a problem can be traced back to where the user was.
let lastPath = '';
router.subscribe((state) => {
  const path = state.location.pathname;
  if (path !== lastPath) log.info('router', `Opened ${path}`);
  lastPath = path;
});

export function App() {
  return (
    <>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
      <Toasts />
    </>
  );
}
