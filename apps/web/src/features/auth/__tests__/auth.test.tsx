import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../AuthProvider';
import { ProtectedRoute } from '../../../routes/ProtectedRoute';

describe('AUTH-001 Frontend Authentication Unit Tests', () => {
  it('renders ProtectedRoute loading state when loading is true', () => {
    const mockAuthContext = {
      user: null,
      loading: true,
      error: null,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </AuthContext.Provider>
    );

    expect(screen.getByLabelText('Loading authentication status')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('redirects unauthenticated users to /login', () => {
    const mockAuthContext = {
      user: null,
      loading: false,
      error: null,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Login Page')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('renders protected content when user is authenticated', () => {
    const mockUser = { uid: 'test-123', email: 'test@wherezit.dev' } as any;

    const mockAuthContext = {
      user: mockUser,
      loading: false,
      error: null,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn().mockResolvedValue('fake-firebase-token'),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Protected Content')).toBeDefined();
  });
});
