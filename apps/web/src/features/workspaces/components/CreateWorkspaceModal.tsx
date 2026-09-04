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
  inventoryNamespaceId?: string;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  inventoryNamespaceId,
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
      const newWs = await createWs({ name: data.name, inventoryNamespaceId });
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
        backgroundColor: 'var(--color-modal-overlay, rgba(15, 23, 42, 0.65))',
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
        className="create-workspace-modal-dialog modal-surface"
        style={{
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '460px',
          padding: '2rem',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 id="create-workspace-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', margin: 0 }}>
              Create Workspace
            </h2>
            <p id="create-workspace-desc" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.25rem', margin: 0 }}>
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
              color: 'var(--color-text-muted, #94a3b8)',
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
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="modalWorkspaceName"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.5rem' }}
            >
              Workspace Name
            </label>
            <input
              id="modalWorkspaceName"
              type="text"
              maxLength={100}
              placeholder="e.g., Summer Cabin, Office, Garage"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'modalWorkspaceName-error' : undefined}
              autoFocus
              {...register('name')}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '0.9375rem',
                color: 'var(--color-input-text, #0f172a)',
                backgroundColor: 'var(--color-input-bg, #ffffff)',
                border: errors.name ? '2px solid var(--color-danger, #ef4444)' : '1px solid var(--color-input-border, #cbd5e1)',
                borderRadius: '0.5rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.name && (
              <span
                id="modalWorkspaceName-error"
                role="alert"
                style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.8125rem', fontWeight: 500, marginTop: '0.375rem', display: 'block' }}
              >
                {errors.name.message}
              </span>
            )}
          </div>

          {mutationError && (
            <div
              role="alert"
              style={{
                backgroundColor: 'var(--color-danger-bg, #fef2f2)',
                border: '1px solid var(--color-danger, #fecaca)',
                color: 'var(--color-danger, #991b1b)',
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
              className="btn btn-secondary btn--md"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary btn--md"
              disabled={isPending}
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
