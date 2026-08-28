import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  fetchContainers,
  createContainer,
  updateContainer,
  archiveContainer,
  restoreContainer,
  deleteContainer,
  fetchContainer,
} from '../api/containerApi';
import { CreateContainerRequest, UpdateContainerRequest } from '../types/container';

export function useContainers(workspaceId: string | undefined, storageNodeId?: string, includeArchived: boolean = false) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['containers', workspaceId, storageNodeId, includeArchived],
    queryFn: () => fetchContainers(workspaceId!, getIdToken, storageNodeId, includeArchived),
    enabled: !!workspaceId,
  });
}

export function useContainer(workspaceId: string | undefined, containerId: string | undefined) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['container', workspaceId, containerId],
    queryFn: () => fetchContainer(workspaceId!, containerId!, getIdToken),
    enabled: !!workspaceId && !!containerId,
  });
}


export function useCreateContainer(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContainerRequest) => createContainer(workspaceId, data, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
    },
  });
}

export function useUpdateContainer(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ containerId, data }: { containerId: string; data: UpdateContainerRequest }) =>
      updateContainer(workspaceId, containerId, data, getIdToken),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, variables.containerId] });
    },
  });
}

export function useArchiveContainer(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (containerId: string) => archiveContainer(workspaceId, containerId, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
    },
  });
}

export function useRestoreContainer(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (containerId: string) => restoreContainer(workspaceId, containerId, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
    },
  });
}

export function useDeleteContainer(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (containerId: string) => deleteContainer(workspaceId, containerId, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId] });
    },
  });
}

