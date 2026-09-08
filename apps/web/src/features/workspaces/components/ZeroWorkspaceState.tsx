import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateWorkspace } from '../hooks/useWorkspaces';

const createWorkspaceSchema = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, { message: 'Storage Space name is required.' })
    .refine((val) => val.length <= 100, { message: 'Storage Space name cannot exceed 100 characters.' }),
});

type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;

export const ZeroWorkspaceState: React.FC = () => {
  const { mutateAsync: createWs, isPending, error: mutationError } = useCreateWorkspace();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
  });

  const onSubmit = async (data: CreateWorkspaceFormData) => {
    try {
      await createWs({ name: data.name });
    } catch {
      // Error state handled by TanStack Query mutationError
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      {/* Onboarding Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            color: 'var(--color-primary, #0284c7)',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.025em', marginBottom: '0.625rem' }}>
          Welcome to WherezIt
        </h1>
        <p style={{ fontSize: '1.0625rem', color: 'var(--color-text-muted, #475569)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.6 }}>
          Set up your first Storage Space to start organizing your locations, containers, and items.
        </p>
      </div>

      {/* Main Workspace Creation Card */}
      <div
        className="zero-workspace-card"
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '1rem',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
          padding: '2.25rem',
          maxWidth: '520px',
          margin: '0 auto 3rem auto',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.5rem' }}>
          Create Your First Storage Space
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
          A Storage Space represents a primary location you manage, such as your home, apartment, garage, or office.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="workspaceName"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.5rem' }}
            >
              Storage Space Name
            </label>
            <input
              id="workspaceName"
              type="text"
              placeholder="e.g., My Home, Storage Unit, Main Office"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'workspaceName-error' : undefined}
              {...register('name')}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '0.9375rem',
                color: 'var(--color-input-text, #0f172a)',
                backgroundColor: 'var(--color-input-bg, #ffffff)',
                border: errors.name ? '2px solid #ef4444' : '1px solid var(--color-input-border, #cbd5e1)',
                borderRadius: '0.5rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
            />
            {errors.name && (
              <span
                id="workspaceName-error"
                role="alert"
                style={{ color: '#ef4444', fontSize: '0.8125rem', fontWeight: 500, marginTop: '0.375rem', display: 'block' }}
              >
                {errors.name.message}
              </span>
            )}
          </div>

          {mutationError && (
            <div
              role="alert"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
              }}
            >
              {mutationError.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              padding: '0.875rem 1.25rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.75 : 1,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {isPending ? (
              <>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Creating Storage Space...
              </>
            ) : (
              'Create Storage Space'
            )}
          </button>
        </form>
      </div>

      {/* How WherezIt Works Onboarding Guide */}
      <div style={{ marginTop: '3.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', textAlign: 'center', marginBottom: '1.75rem' }}>
          How WherezIt Works
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border, #f1f5f9)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📍</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text, #0f172a)', marginBottom: '0.25rem' }}>
              1. Organize Locations
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5 }}>
              Set up rooms, shelves, closets, and racks in a clear hierarchy.
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border, #f1f5f9)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text, #0f172a)', marginBottom: '0.25rem' }}>
              2. Label Containers
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5 }}>
              Assign permanent BOX IDs and generate printable QR or Barcode labels.
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border, #f1f5f9)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✨</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text, #0f172a)', marginBottom: '0.25rem' }}>
              3. AI Item Capture
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5 }}>
              Snap photos of box contents for automated AI item detection and review.
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border, #f1f5f9)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text, #0f172a)', marginBottom: '0.25rem' }}>
              4. Instant Search
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5 }}>
              Search any item or box to find its exact location in seconds.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
