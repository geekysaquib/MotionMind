import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { GuestOnly, RequireAuth, RequireOnboarded } from './layout/guards';
import { LoginPage } from './pages/auth/LoginPage';
import { Toasts } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { log } from './lib/logger';
import { PageFallback } from './components/PageFallback';

// Every page is its own chunk, loaded when it is first opened, so the app starts fast.
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import('./pages/app/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const DiscoverPage = lazy(() => import('./pages/app/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const LibraryPage = lazy(() => import('./pages/app/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ProjectLayout = lazy(() => import('./pages/app/ProjectLayout').then((m) => ({ default: m.ProjectLayout })));
const ProjectOverviewPage = lazy(() => import('./pages/app/ProjectOverviewPage').then((m) => ({ default: m.ProjectOverviewPage })));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ProfileSettings = lazy(() => import('./pages/app/ProfileSettings').then((m) => ({ default: m.ProfileSettings })));
const AccountSettings = lazy(() => import('./pages/app/AccountSettings').then((m) => ({ default: m.AccountSettings })));
const DiagnosticsSettings = lazy(() => import('./pages/app/DiagnosticsSettings').then((m) => ({ default: m.DiagnosticsSettings })));
const ScriptStagePage = lazy(() => import('./pages/app/ScriptStagePage').then((m) => ({ default: m.ScriptStagePage })));
const ResearchStagePage = lazy(() => import('./pages/app/ResearchStagePage').then((m) => ({ default: m.ResearchStagePage })));
const StoryboardStagePage = lazy(() => import('./pages/app/StoryboardStagePage').then((m) => ({ default: m.StoryboardStagePage })));
const VoiceStagePage = lazy(() => import('./pages/app/VoiceStagePage').then((m) => ({ default: m.VoiceStagePage })));
const ExportStagePage = lazy(() => import('./pages/app/ExportStagePage').then((m) => ({ default: m.ExportStagePage })));
const StyleStagePage = lazy(() => import('./pages/app/StyleStagePage').then((m) => ({ default: m.StyleStagePage })));
const AnimateStagePage = lazy(() => import('./pages/app/AnimateStagePage').then((m) => ({ default: m.AnimateStagePage })));
const FootagePage = lazy(() => import('./pages/app/FootagePage').then((m) => ({ default: m.FootagePage })));
const AnalyticsPage = lazy(() => import('./pages/app/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ConnectionsSettings = lazy(() => import('./pages/app/ConnectionsSettings').then((m) => ({ default: m.ConnectionsSettings })));
const FootageEditPage = lazy(() => import('./pages/app/FootageEditPage').then((m) => ({ default: m.FootageEditPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));

const page = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

export const routes = [
  { path: '/', element: page(<LandingPage />) },
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  // Sign-up is the same email-code screen; old links still land somewhere useful.
  { path: '/signup', element: <Navigate to="/login" replace /> },
  { path: '/onboarding', element: <RequireAuth>{page(<OnboardingPage />)}</RequireAuth> },
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
      { index: true, element: page(<DashboardPage />) },
      { path: 'discover', element: page(<DiscoverPage />) },
      { path: 'library', element: page(<LibraryPage />) },
      { path: 'footage', element: page(<FootagePage />) },
      { path: 'analytics', element: page(<AnalyticsPage />) },
      { path: 'footage/:id', element: page(<FootageEditPage />) },
      {
        path: 'projects/:id',
        element: page(<ProjectLayout />),
        children: [
          { index: true, element: page(<ProjectOverviewPage />) },
          { path: 'research', element: page(<ResearchStagePage />) },
          { path: 'script', element: page(<ScriptStagePage />) },
          { path: 'storyboard', element: page(<StoryboardStagePage />) },
          { path: 'graphics', element: page(<StyleStagePage />) },
          { path: 'animate', element: page(<AnimateStagePage />) },
          { path: 'voice', element: page(<VoiceStagePage />) },
          // The Reel editor became part of the Voice step; old links land there.
          { path: 'editor', element: <Navigate to="../voice" replace relative="path" /> },
          { path: 'export', element: page(<ExportStagePage />) },
        ],
      },
      {
        path: 'settings',
        element: page(<SettingsPage />),
        children: [
          { index: true, element: page(<ProfileSettings />) },
          { path: 'connections', element: page(<ConnectionsSettings />) },
          { path: 'account', element: page(<AccountSettings />) },
          { path: 'diagnostics', element: page(<DiagnosticsSettings />) },
        ],
      },
    ],
  },
  { path: '*', element: page(<NotFoundPage />) },
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
