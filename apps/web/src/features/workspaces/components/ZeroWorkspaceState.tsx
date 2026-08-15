import React from 'react';
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
      // Error handled by TanStack mutation state
    }
  };

  return (
    <div className="zero-workspace-container" style={{ maxWidth: '500px', margin: '3rem auto', padding: '2rem', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
      <h2 style={{ marginBottom: '1rem' }}>Welcome to WherezIt!</h2>
      <p style={{ color: '#555', marginBottom: '1.5rem' }}>
        You don't belong to any workspace yet. Create your first workspace to start organizing your inventory locations and items.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="workspaceName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Workspace Name
          </label>
          <input
            id="workspaceName"
            type="text"
            placeholder="e.g., My Home, Main Office"
            {...register('name')}
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          {errors.name && (
            <span className="error-message" style={{ color: '#c0392b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
              {errors.name.message}
            </span>
          )}
        </div>

        {mutationError && (
          <div className="form-error" style={{ color: '#c0392b', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {mutationError.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
          style={{ width: '100%', padding: '0.75rem', backgroundColor: '#2980b9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isPending ? 'Creating Workspace...' : 'Create Workspace'}
        </button>
      </form>
    </div>
  );
};
