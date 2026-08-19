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
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f8fafc' }}>
      <style>{`
        @media (max-width: 900px) {
          .auth-split-container {
            flex-direction: column !important;
          }
          .auth-left-panel {
            padding: 2.5rem 1.5rem !important;
            min-height: auto !important;
          }
          .auth-right-panel {
            padding: 2rem 1.5rem !important;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2.5rem' }}>
            <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
            <span style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff' }}>WherezIt</span>
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem', color: '#ffffff', maxWidth: '480px' }}>
            Organize everything in your home.
          </h1>

          <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '2rem', maxWidth: '460px', lineHeight: 1.6 }}>
            Create your account to start tracking boxes, scanning QR/barcode labels, and cataloging items with AI assistance.
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
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ maxWidth: '420px', width: '100%' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Create an account
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2rem' }}>
              Get started with WherezIt in seconds.
            </p>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...register('email')}
                  onChange={() => clearError()}
                  disabled={submitting}
                />
                {errors.email && <span className="field-error">{errors.email.message}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  onChange={() => clearError()}
                  disabled={submitting}
                />
                {errors.password && <span className="field-error">{errors.password.message}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  onChange={() => clearError()}
                  disabled={submitting}
                />
                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword.message}</span>}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }}
                disabled={submitting}
              >
                {submitting ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
