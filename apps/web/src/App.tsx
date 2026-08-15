import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/useAuth';
import { LoginForm } from './features/auth/LoginForm';
import { SignupForm } from './features/auth/SignupForm';
import { ProtectedRoute } from './routes/ProtectedRoute';

const Dashboard: React.FC = () => {
  const { user, signOut, getIdToken } = useAuth();
  const [tokenSnippet, setTokenSnippet] = React.useState<string>('');

  const handleFetchToken = async () => {
    const token = await getIdToken();
    if (token) {
      setTokenSnippet(token.substring(0, 20) + '...');
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>WherezIt App Shell</h1>
        <div className="user-info">
          <span>Signed in as: <strong>{user?.email}</strong></span>
          <button className="btn-secondary" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h2>Welcome to WherezIt Inventory Management</h2>
        <p>Your authentication token is active.</p>
        <button className="btn-primary" onClick={handleFetchToken}>
          Retrieve ID Token for API
        </button>
        {tokenSnippet && (
          <div className="token-preview">
            <p>ID Token Snippet: <code>{tokenSnippet}</code></p>
          </div>
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
