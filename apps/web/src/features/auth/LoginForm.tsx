import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from './useAuth';
import { Link, useNavigate } from 'react-router-dom';

import { loginSchema, LoginFormData } from './utils/authValidation';

export const LoginForm: React.FC = () => {
  const { signIn, error, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    mode: 'onTouched',
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setSubmitting(true);
    try {
      await signIn(data.email, data.password);
      const returnPath = sessionStorage.getItem('returnPath');
      if (returnPath && returnPath.startsWith('/scan/')) {
        sessionStorage.removeItem('returnPath');
        navigate(returnPath);
      } else {
        navigate('/');
      }
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
          .login-hero-headline {
            white-space: normal !important;
            font-size: 1.65rem !important;
          }
          .login-hero-sub {
            font-size: 0.95rem !important;
            margin-bottom: 1.25rem !important;
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
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="auth-brand-header" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2.5rem' }}>
            <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '44px', height: '44px', borderRadius: '12px' }} />
            <span style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff' }}>WherezIt</span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.375rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.75rem', color: '#ffffff', maxWidth: '600px' }} className="login-hero-headline">
            Your Things. Always Findable.
          </h1>

          <p className="login-hero-sub" style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '2.5rem', maxWidth: '520px', lineHeight: 1.5 }}>
            App that remembers for you.
          </p>

          {/* Product Value Story Card */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1rem',
              padding: '1.25rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              EXAMPLE SEARCH
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '0.65rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '0.875rem', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span>
              <span>Where are my Christmas lights?</span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', backgroundColor: '#0f172a', padding: '0.875rem', borderRadius: '0.5rem', border: '1px solid #334155', alignItems: 'center' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '0.375rem', backgroundColor: '#1e293b', border: '1px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', flexShrink: 0 }}>
                🎄
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Christmas Lights</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, flexShrink: 0 }}>
                    BOX 001
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>BOX 001 — Holiday Decorations</span>
                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>Garage → Rack A → Shelf 1</span>
              </div>
            </div>
          </div>
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
              Welcome back
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '2rem' }}>
              Sign in to WherezIt to manage your stored items.
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

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>Password</label>
                </div>
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
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: 'var(--color-primary-text, #0284c7)', fontWeight: 700, textDecoration: 'none' }}>
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
