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
import { SettingsPage } from './pages/app/SettingsPage';
import { ProfileSettings } from './pages/app/ProfileSettings';
import { AccountSettings } from './pages/app/AccountSettings';
import { DiagnosticsSettings } from './pages/app/DiagnosticsSettings';
import { ConnectorsSettings } from './pages/app/ConnectorsSettings';
import { ScriptStagePage } from './pages/app/ScriptStagePage';
import { ResearchStagePage } from './pages/app/ResearchStagePage';
import { StoryboardStagePage } from './pages/app/StoryboardStagePage';
import { VoiceStagePage } from './pages/app/VoiceStagePage';
import { ReelEditorPage } from './pages/app/ReelEditorPage';
import { ExportStagePage } from './pages/app/ExportStagePage';
import { StyleStagePage } from './pages/app/StyleStagePage';
import { FootagePage } from './pages/app/FootagePage';
import { FootageEditPage } from './pages/app/FootageEditPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { Toasts } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { log } from './lib/logger';

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
      { path: 'footage', element: <FootagePage /> },
      { path: 'footage/:id', element: <FootageEditPage /> },
      {
        path: 'projects/:id',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: 'research', element: <ResearchStagePage /> },
          { path: 'script', element: <ScriptStagePage /> },
          { path: 'storyboard', element: <StoryboardStagePage /> },
          { path: 'graphics', element: <StyleStagePage /> },
          { path: 'voice', element: <VoiceStagePage /> },
          { path: 'editor', element: <ReelEditorPage /> },
          { path: 'export', element: <ExportStagePage /> },
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
