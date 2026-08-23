import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateWorkspace } from '../hooks/useWorkspaces';

const createWorkspaceSchema = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, { message: 'Workspace name is required.' })
    .refine((val) => val.length <= 100, { message: 'Workspace name cannot exceed 100 characters.' }),
});

type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workspaceId: string) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { mutateAsync: createWs, isPending, error: mutationError } = useCreateWorkspace();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
  });

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const onSubmit = async (data: CreateWorkspaceFormData) => {
    try {
      const newWs = await createWs({ name: data.name });
      reset();
      onClose();
      if (onCreated && newWs?.id) {
        onCreated(newWs.id);
      }
    } catch {
      // Error handled by mutationError
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
        aria-describedby="create-workspace-desc"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: '460px',
          padding: '2rem',
          border: '1px solid #e2e8f0',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 id="create-workspace-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Create Workspace
            </h2>
            <p id="create-workspace-desc" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', margin: 0 }}>
              A workspace represents a place you organize, such as your home, garage, or storage unit.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="modalWorkspaceName"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}
            >
              Workspace Name
            </label>
            <input
              id="modalWorkspaceName"
              type="text"
              placeholder="e.g., Summer Cabin, Office, Garage"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'modalWorkspaceName-error' : undefined}
              autoFocus
              {...register('name')}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '0.9375rem',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: errors.name ? '2px solid #ef4444' : '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.name && (
              <span
                id="modalWorkspaceName-error"
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
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
              }}
            >
              {mutationError.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.75 : 1,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {isPending ? (
                <>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
