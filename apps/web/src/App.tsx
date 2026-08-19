import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginForm } from './features/auth/LoginForm';
import { SignupForm } from './features/auth/SignupForm';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { WorkspaceProvider } from './features/workspaces/context/WorkspaceContext';

import { ScanResolverScreen } from './features/identifiers/components/ScanResolverScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
