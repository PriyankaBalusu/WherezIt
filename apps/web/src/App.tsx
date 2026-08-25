import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginForm } from './features/auth/LoginForm';
import { SignupForm } from './features/auth/SignupForm';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { WorkspaceProvider } from './features/workspaces/context/WorkspaceContext';

import { ScanResolverScreen } from './features/identifiers/components/ScanResolverScreen';
import { ContainerDetailScreen } from './features/containers/components/ContainerDetailScreen';
import { ContainerErrorBoundary } from './features/containers/components/ContainerErrorBoundary';
import { WorkspaceSearch } from './features/search/components/WorkspaceSearch';
import { CaptureReviewScreen } from './features/ai-review/components/CaptureReviewScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const WorkspaceSearchScreen: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  return <WorkspaceSearch workspaceId={workspaceId!} initialQuery={query} />;
};

const CaptureReviewScreenWrapper: React.FC = () => {
  const { workspaceId, captureId } = useParams<{ workspaceId: string; captureId: string }>();
  const navigate = useNavigate();

  return (
    <CaptureReviewScreen
      workspaceId={workspaceId!}
      captureId={captureId!}
      onNavigateToManualEntry={(containerId) => navigate(`/workspaces/${workspaceId}/containers/${containerId}`)}
      onConfirmSuccess={(containerId) => navigate(`/workspaces/${workspaceId}/containers/${containerId}`)}
    />
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<SignupForm />} />
            <Route path="/scan/:tokenValue" element={<ScanResolverScreen />} />
            <Route
              path="/scan"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <React.Suspense fallback={<div>Loading Scan...</div>}>
                      {React.createElement(React.lazy(() => import('./features/identifiers/components/GlobalScanScreen').then(m => ({ default: m.GlobalScanScreen }))))}
                    </React.Suspense>
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId/locations/:locationId"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <React.Suspense fallback={<div>Loading Location...</div>}>
                      {React.createElement(React.lazy(() => import('./features/locations/components/LocationDetailScreen').then(m => ({ default: m.LocationDetailScreen }))))}
                    </React.Suspense>
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId/quick-pack"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <React.Suspense fallback={<div>Loading Moving Assistant...</div>}>
                      {React.createElement(React.lazy(() => import('./features/containers/QuickPackScreen').then(m => ({ default: m.QuickPackScreen }))))}
                    </React.Suspense>
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId/moving-assistant"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <React.Suspense fallback={<div>Loading Moving Assistant...</div>}>
                      {React.createElement(React.lazy(() => import('./features/containers/QuickPackScreen').then(m => ({ default: m.QuickPackScreen }))))}
                    </React.Suspense>
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId/containers/:containerId"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <ContainerErrorBoundary>
                      <ContainerDetailScreen />
                    </ContainerErrorBoundary>
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId/search"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <WorkspaceSearchScreen />
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId/captures/:captureId/review"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <CaptureReviewScreenWrapper />
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <WorkspaceProvider />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
};

export default App;

