import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../AuthProvider';
import { AccountMenu } from '../AccountMenu';
import { ChangePasswordModal } from '../ChangePasswordModal';
import * as firebaseAuth from 'firebase/auth';

// Mock Firebase Auth module
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  return {
    ...actual,
    EmailAuthProvider: {
      credential: vi.fn().mockImplementation((email, pass) => ({ email, pass, providerId: 'password' })),
    },
    reauthenticateWithCredential: vi.fn(),
    updatePassword: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  };
});

describe('Account & Password UX Correction Unit Tests', () => {
  const mockUser = {
    uid: 'secret-firebase-uid-999',
    email: 'test1@gmail.com',
    emailVerified: false,
  } as any;

  const mockAuthContext = {
    user: mockUser,
    loading: false,
    error: null,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getIdToken: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AccountMenu renders avatar button with aria-label="Account" and opens streamlined dropdown', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <AccountMenu />
      </AuthContext.Provider>
    );

    const avatarBtn = screen.getByRole('button', { name: /^Account$/i });
    expect(avatarBtn).toBeInTheDocument();

    // Click avatar -> opens compact dropdown
    fireEvent.click(avatarBtn);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('SIGNED IN AS')).toBeInTheDocument();
    expect(screen.getByText('test1@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /🔒 Change Password/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /🚪 Sign Out/i })).toBeInTheDocument();

    // Must NOT contain redundant Account menu item
    expect(screen.queryByRole('menuitem', { name: /👤 Account/i })).toBeNull();
  });

  it('ChangePasswordModal validates password confirmation mismatch locally', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={true} onClose={vi.fn()} />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: 'differentpass' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/New passwords do not match/i);
    });

    expect(firebaseAuth.reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(firebaseAuth.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('ChangePasswordModal handles wrong current password reauthentication failure', async () => {
    const error: any = new Error('Wrong password');
    error.code = 'auth/wrong-password';
    vi.mocked(firebaseAuth.reauthenticateWithCredential).mockRejectedValueOnce(error);

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={true} onClose={vi.fn()} />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: 'wrongpass' } });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: 'newpass123' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Current password is incorrect/i);
    });

    // NO reset email sent automatically, NO sign out
    expect(firebaseAuth.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockAuthContext.signOut).not.toHaveBeenCalled();
  });

  it('ChangePasswordModal reauthenticates and updates password cleanly when current password is valid', async () => {
    vi.mocked(firebaseAuth.reauthenticateWithCredential).mockResolvedValueOnce({} as any);
    vi.mocked(firebaseAuth.updatePassword).mockResolvedValueOnce();

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={true} onClose={vi.fn()} />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: 'correctpass' } });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: 'newpass123' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Password updated successfully/i);
    });

    expect(firebaseAuth.reauthenticateWithCredential).toHaveBeenCalled();
    expect(firebaseAuth.updatePassword).toHaveBeenCalled();
    expect(firebaseAuth.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends reset email ONLY after explicit confirmation flow', async () => {
    vi.mocked(firebaseAuth.sendPasswordResetEmail).mockResolvedValueOnce();

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={true} onClose={vi.fn()} />
      </AuthContext.Provider>
    );

    const forgotBtn = screen.getByRole('button', { name: /Forgot password\?/i });
    fireEvent.click(forgotBtn);

    // Shows reset password confirmation view
    expect(screen.getByText(/Send a password reset link to:/i)).toBeInTheDocument();
    expect(screen.getByText('test1@gmail.com')).toBeInTheDocument();

    const sendEmailBtn = screen.getByRole('button', { name: /^Send Email$/i });
    fireEvent.click(sendEmailBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Password reset email sent/i);
    });

    expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'test1@gmail.com');
  });

  it('clears stale modal state when ChangePasswordModal is closed and reopened', async () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={true} onClose={handleClose} />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: 'temp-pass' } });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Password must be at least 6 characters long/i);
    });

    // Close modal
    rerender(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={false} onClose={handleClose} />
      </AuthContext.Provider>
    );

    // Reopen modal
    rerender(
      <AuthContext.Provider value={mockAuthContext}>
        <ChangePasswordModal isOpen={true} onClose={handleClose} />
      </AuthContext.Provider>
    );

    // Must be completely fresh
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByLabelText(/Current Password/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/^New Password$/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Confirm New Password/i) as HTMLInputElement).value).toBe('');
  });
});
