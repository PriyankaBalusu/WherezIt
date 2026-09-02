import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../AuthProvider';
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

import { fireEvent } from '@testing-library/react';
import { LoginForm } from '../LoginForm';
import { SignupForm } from '../SignupForm';

describe('Auth Forms Redesign & Usability Suite', () => {
  it('renders LoginForm with hero headline, example search card, password toggle, and signup link', () => {
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
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Hero branding & headline
    expect(screen.getByText('Your Things. Always Findable.')).toBeDefined();
    expect(screen.getByText('App that remembers for you.')).toBeDefined();

    // Compact Example Search card
    expect(screen.getByText('Where are my Christmas lights?')).toBeDefined();
    expect(screen.getByText('BOX 001 — Holiday Decorations')).toBeDefined();

    // Form header & elements
    expect(screen.getByText('Welcome back')).toBeDefined();
    expect(screen.getByLabelText('Email Address')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();

    // Show/hide password toggle
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButton = screen.getByRole('button', { name: /Show password/i });
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    // Link to Sign Up
    expect(screen.getByRole('link', { name: /Sign Up/i })).toBeDefined();
  });

  it('renders SignupForm with concise hero headline, password toggles, and signin link', () => {
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
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Concise Hero headline & copy
    expect(screen.getByText('Organize everything in your home.')).toBeDefined();
    expect(screen.getByText('Track boxes, scan labels, and find things instantly.')).toBeDefined();

    // Form elements
    expect(screen.getByText('Create an account')).toBeDefined();
    expect(screen.getByLabelText('Email Address')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByLabelText('Confirm Password')).toBeDefined();

    // Link to Sign In
    expect(screen.getByRole('link', { name: /Sign In/i })).toBeDefined();
  });
});

