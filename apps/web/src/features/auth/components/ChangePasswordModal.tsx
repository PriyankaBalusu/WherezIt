import React, { useState, useEffect } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useAuth } from '../useAuth';
import { auth } from '../../../config/firebase';
import { validateNewPassword } from '../utils/authValidation';
import { PasswordRequirementsChecklist } from './PasswordRequirementsChecklist';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user: authUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resetEmailMessage, setResetEmailMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [touched, setTouched] = useState<{ currentPassword?: boolean; newPassword?: boolean; confirmPassword?: boolean }>({});

  const resetState = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTouched({});
    setError(null);
    setSuccessMessage(null);
    setResetEmailMessage(null);
    setShowResetConfirm(false);
    setIsSubmitting(false);
    setIsSendingReset(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetState();
    onClose();
  };

  const currentPasswordError = touched.currentPassword && !currentPassword ? 'Current password is required.' : null;
  const newPasswordError = touched.newPassword && (!newPassword ? 'New password is required.' : !validateNewPassword(newPassword) ? 'Please complete all password requirements.' : null);
  const confirmPasswordError = touched.confirmPassword && (!confirmPassword ? 'Confirm password is required.' : newPassword !== confirmPassword ? 'Passwords do not match' : null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setResetEmailMessage(null);
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });

    if (!currentPassword) {
      setError('Current password is required.');
      return;
    }
    if (!newPassword) {
      setError('New password is required.');
      return;
    }
    if (!validateNewPassword(newPassword)) {
      setError('Please complete all password requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const user = authUser || auth.currentUser;
    if (!user || !user.email) {
      setError('No active user session found. Please sign in again.');
      return;
    }

    try {
      setIsSubmitting(true);
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setSuccessMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.');
      } else {
        setError(err?.message || 'Failed to update password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    setError(null);
    setSuccessMessage(null);
    setResetEmailMessage(null);

    const user = authUser || auth.currentUser;
    if (!user || !user.email) {
      setError('No active user session found. Please sign in again.');
      return;
    }

    try {
      setIsSendingReset(true);
      await sendPasswordResetEmail(auth, user.email);
      setResetEmailMessage('Password reset email sent.');
      setShowResetConfirm(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const userEmail = (authUser || auth.currentUser)?.email || 'your email';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--color-modal-overlay, rgba(0, 0, 0, 0.5))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-modal-title"
    >
      <div
        className="change-password-modal-dialog modal-surface"
        style={{
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '420px',
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="change-password-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
            {showResetConfirm ? 'Reset Password' : 'Change Password'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Change Password"
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {error && (
          <div role="alert" style={{ backgroundColor: 'var(--color-danger-bg, #fef2f2)', border: '1px solid var(--color-danger, #fca5a5)', color: 'var(--color-danger, #dc2626)', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div role="status" style={{ backgroundColor: 'var(--color-success-bg, #f0fdf4)', border: '1px solid var(--color-success, #86efac)', color: 'var(--color-success, #166534)', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            ✓ {successMessage}
          </div>
        )}

        {resetEmailMessage && (
          <div role="status" style={{ backgroundColor: 'var(--color-primary-light, #f0f9ff)', border: '1px solid var(--color-primary, #7dd3fc)', color: 'var(--color-primary-text, #0369a1)', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            ✉ {resetEmailMessage}
          </div>
        )}

        {showResetConfirm ? (
          /* Lightweight Reset Password Confirmation View */
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #334155)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Send a password reset link to:
            </p>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', backgroundColor: 'var(--color-surface-raised, #f8fafc)', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong, #e2e8f0)', marginBottom: '1.5rem' }}>
              {userEmail}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setShowResetConfirm(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                onClick={handleSendResetEmail}
                disabled={isSendingReset}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                {isSendingReset ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        ) : (
          /* Primary Change Password Form */
          <form onSubmit={handleUpdatePassword}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="currentPassword" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem' }}>
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, currentPassword: true }))}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--color-input-border, #cbd5e1)',
                  backgroundColor: 'var(--color-input-bg, #ffffff)',
                  color: 'var(--color-input-text, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {currentPasswordError && (
                <span className="field-error" style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {currentPasswordError}
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="newPassword" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem' }}>
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, newPassword: true }))}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--color-input-border, #cbd5e1)',
                  backgroundColor: 'var(--color-input-bg, #ffffff)',
                  color: 'var(--color-input-text, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <PasswordRequirementsChecklist password={newPassword} />
              {newPasswordError && (
                <span className="field-error" style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {newPasswordError}
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem' }}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--color-input-border, #cbd5e1)',
                  backgroundColor: 'var(--color-input-bg, #ffffff)',
                  color: 'var(--color-input-text, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {confirmPasswordError && (
                <span className="field-error" style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {confirmPasswordError}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowResetConfirm(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--color-primary, #0284c7)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                }}
              >
                Forgot password?
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn--md"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
