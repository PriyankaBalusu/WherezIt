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

describe('AUTH-002 Auth Form Validation UX Suite', () => {
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

  it('1. Untouched email field shows no error', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText(/Enter a valid email address/i)).toBeNull();
    expect(screen.queryByText(/Email address is required/i)).toBeNull();
  });

  it('2. Invalid email before blur shows no premature error', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const emailInput = screen.getByLabelText('Email Address');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    expect(screen.queryByText(/Enter a valid email address/i)).toBeNull();
  });

  it('3. Blur invalid email shows format error', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const emailInput = screen.getByLabelText('Email Address');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    expect(await screen.findByText(/Enter a valid email address/i)).toBeInTheDocument();
  });

  it('4. Editing touched invalid email into valid email clears error immediately', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const emailInput = screen.getByLabelText('Email Address');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    expect(await screen.findByText(/Enter a valid email address/i)).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });

    expect(screen.queryByText(/Enter a valid email address/i)).toBeNull();
  });

  it('5. Blur empty required email shows required message', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const emailInput = screen.getByLabelText('Email Address');
    fireEvent.focus(emailInput);
    fireEvent.blur(emailInput);

    expect(await screen.findByText(/Email address is required/i)).toBeInTheDocument();
  });

  it('6. Submit invalid email blocks submission', async () => {
    const mockSignUp = vi.fn();
    render(
      <AuthContext.Provider value={{ ...mockAuthContext, signUp: mockSignUp }}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    expect(await screen.findByText(/Email address is required/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('7. Untouched password shows no error', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText(/Password does not meet the required security rules/i)).toBeNull();
  });

  it('1. "password123!" -> invalid: uppercase missing', () => {
    expect(validateNewPassword('password123!')).toBe(false);
  });

  it('2. "PASSWORD123!" -> invalid: lowercase missing', () => {
    expect(validateNewPassword('PASSWORD123!')).toBe(false);
  });

  it('3. "Password!!!!" -> invalid: number missing', () => {
    expect(validateNewPassword('Password!!!!')).toBe(false);
  });

  it('4. "Password1234" -> invalid: special character missing', () => {
    expect(validateNewPassword('Password1234')).toBe(false);
  });

  it('5. "Pass1!" -> invalid: fewer than 10 characters', () => {
    expect(validateNewPassword('Pass1!')).toBe(false);
  });

  it('6. "WherezIt1!" -> valid', () => {
    expect(validateNewPassword('WherezIt1!')).toBe(true);
  });

  it('7. Password with space but no symbol ("WherezIt1 hello") is invalid', () => {
    expect(validateNewPassword('WherezIt1 hello')).toBe(false);
  });

  it('8. Password with symbol and space ("WherezIt1! hello") is valid', () => {
    expect(validateNewPassword('WherezIt1! hello')).toBe(true);
  });

  it('9. Passwords with symbols like "_", "-", and "©" (e.g. "WherezIt1_") are valid', () => {
    expect(validateNewPassword('WherezIt1_')).toBe(true);
    expect(validateNewPassword('WherezIt1-')).toBe(true);
    expect(validateNewPassword('WherezIt1©')).toBe(true);
  });

  it('10. Checklist renders concise label "Special character" and indicator updates live', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Special character')).toBeInTheDocument();
    expect(screen.queryByText(/Special character \(symbol\/space\)/i)).toBeNull();

    const passwordInput = screen.getByLabelText('Password');

    // Type a password satisfying uppercase, lowercase, digit, special, and length 10
    fireEvent.change(passwordInput, { target: { value: 'WherezIt1!' } });

    // Verify all 5 items show checkmark indicator
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(5);
    listItems.forEach((li) => {
      expect(li.textContent).toContain('✓');
    });
  });

  it('10. Valid password clears validation state on blur', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const passwordInput = screen.getByLabelText('Password');
    // First type invalid password and blur
    fireEvent.change(passwordInput, { target: { value: 'invalid' } });
    fireEvent.blur(passwordInput);

    expect(await screen.findByText(/Please complete all password requirements/i)).toBeInTheDocument();
    expect(screen.queryByText(/Password does not meet the required security rules/i)).toBeNull();

    // Now type valid password
    fireEvent.change(passwordInput, { target: { value: 'WherezIt1!' } });
    expect(screen.queryByText(/Please complete all password requirements/i)).toBeNull();
  });

  it('11. Submit is blocked for invalid new password', async () => {
    const mockSignUp = vi.fn();
    render(
      <AuthContext.Provider value={{ ...mockAuthContext, signUp: mockSignUp }}>
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123!' } }); // missing uppercase
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    expect(await screen.findByText(/Please complete all password requirements/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('12 & 13. Sign In does NOT apply new-password complexity validation and allows legacy passwords', async () => {
    const mockSignIn = vi.fn().mockResolvedValue(undefined);
    render(
      <AuthContext.Provider value={{ ...mockAuthContext, signIn: mockSignIn }}>
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'user@example.com' } });
    // Legacy simple password e.g. "oldpassword" or "1234" is allowed on login form (presence check only)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'oldpassword' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await vi.waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'oldpassword');
    });

    expect(screen.queryByText(/Please complete all password requirements/i)).toBeNull();
  });
});

