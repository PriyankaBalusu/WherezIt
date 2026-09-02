import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './useAuth';
import { Link, useNavigate } from 'react-router-dom';

const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const SignupForm: React.FC = () => {
  const { signUp, error, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true);
    try {
      await signUp(data.email, data.password);
      navigate('/');
    } catch {
      // Error handled in AuthProvider state
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--color-bg, #f8fafc)' }}>
      <style>{`
        @media (max-width: 900px) {
          .auth-split-container {
            flex-direction: column !important;
          }
          .auth-left-panel {
            padding: 2rem 1.25rem !important;
            min-height: auto !important;
          }
          .auth-right-panel {
            padding: 2rem 1.25rem !important;
          }
          .signup-hero-headline {
            white-space: normal !important;
            font-size: 1.65rem !important;
          }
          .signup-hero-sub {
            font-size: 0.95rem !important;
            margin-bottom: 0 !important;
          }
          .auth-brand-header {
            margin-bottom: 1.25rem !important;
          }
        }
      `}</style>

      <div className="auth-split-container" style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
        {/* Left Branded Panel */}
        <div
          className="auth-left-panel"
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '4rem 3rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <div className="auth-brand-header" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2.5rem' }}>
            <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '44px', height: '44px', borderRadius: '12px' }} />
            <span style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff' }}>WherezIt</span>
          </div>

          <h1 className="signup-hero-headline" style={{ fontSize: '2.375rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.75rem', color: '#ffffff', maxWidth: '480px' }}>
            Organize everything in your home.
          </h1>

          <p className="signup-hero-sub" style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '460px', lineHeight: 1.5 }}>
            Track boxes, scan labels, and find things instantly.
          </p>
        </div>

        {/* Right Auth Form Panel */}
        <div
          className="auth-right-panel"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3rem 2rem',
            backgroundColor: 'var(--color-surface, #ffffff)',
          }}
        >
          <div style={{ maxWidth: '420px', width: '100%' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', marginBottom: '0.25rem' }}>
              Create an account
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '2rem' }}>
              Get started with WherezIt in seconds.
            </p>

            {error && (
              <div className="auth-error" role="alert" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-danger-bg, #fef2f2)', color: 'var(--color-danger, #dc2626)', border: '1px solid rgba(220, 38, 38, 0.2)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.375rem' }}>Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...register('email', { onChange: () => clearError() })}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--color-input-border, #cbd5e1)',
                    backgroundColor: 'var(--color-input-bg, #ffffff)',
                    color: 'var(--color-text, #0f172a)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.email && <span className="field-error" style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>{errors.email.message}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.375rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password', { onChange: () => clearError() })}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.75rem 0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-input-border, #cbd5e1)',
                      backgroundColor: 'var(--color-input-bg, #ffffff)',
                      color: 'var(--color-text, #0f172a)',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: 'var(--color-text-muted, #64748b)',
                      padding: '0.25rem',
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password && <span className="field-error" style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>{errors.password.message}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.375rem' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('confirmPassword', { onChange: () => clearError() })}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.75rem 0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-input-border, #cbd5e1)',
                      backgroundColor: 'var(--color-input-bg, #ffffff)',
                      color: 'var(--color-text, #0f172a)',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: 'var(--color-text-muted, #64748b)',
                      padding: '0.25rem',
                    }}
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.confirmPassword && <span className="field-error" style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>{errors.confirmPassword.message}</span>}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--color-primary, #0284c7)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
                disabled={submitting}
              >
                {submitting ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--color-primary-text, #0284c7)', fontWeight: 700, textDecoration: 'none' }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
