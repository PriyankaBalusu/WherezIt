import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './useAuth';
import { Link, useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const { signIn, error, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
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
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2.5rem' }}>
            <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
            <span style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff' }}>WherezIt</span>
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem', color: '#ffffff', maxWidth: '480px' }}>
            Find what you own. Remember where you put it.
          </h1>

          <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '3rem', maxWidth: '460px', lineHeight: 1.6 }}>
            A smarter, AI-assisted way to organize containers, track stored inventory, and locate your belongings instantly.
          </p>

          {/* Product Value Story Card */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1rem',
              padding: '1.5rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              EXAMPLE SEARCH
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '1rem', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span>
              <span>Where are my Christmas lights?</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff' }}>Christmas Lights</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                  BOX 001
                </span>
              </div>
              <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Container: Holiday Decorations</span>
              <span style={{ fontSize: '0.875rem', color: '#f59e0b', fontWeight: 600 }}>📍 Garage › Rack A › Shelf 1</span>
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
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ maxWidth: '420px', width: '100%' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2rem' }}>
              Sign In to WherezIt workspace to manage your stored items.
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

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }}
                disabled={submitting}
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
