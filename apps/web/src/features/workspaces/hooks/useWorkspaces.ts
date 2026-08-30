import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import { fetchWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace } from '../api/workspaceApi';
import { CreateWorkspaceRequest } from '../types/workspace';

export function useWorkspaces() {
  const { getIdToken, user } = useAuth();

  return useQuery({
    queryKey: ['workspaces', user?.uid],
    queryFn: () => fetchWorkspaces(getIdToken),
    enabled: !!user,
  });
}

export function useCreateWorkspace() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => createWorkspace(data, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useRenameWorkspace() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, name }: { workspaceId: string; name: string }) =>
      renameWorkspace(workspaceId, name, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useDeleteWorkspace() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => deleteWorkspace(workspaceId, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
