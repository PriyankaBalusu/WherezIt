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
    <div className="auth-card">
      <h2>Sign In to WherezIt</h2>
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
            {...register('password')}
            onChange={() => clearError()}
            disabled={submitting}
          />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="auth-footer">
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </p>
    </div>
  );
};
