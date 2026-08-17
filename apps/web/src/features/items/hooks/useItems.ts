import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  getItemsByContainer,
  createItem,
  updateItem,
  archiveItem,
  restoreItem,
} from '../api/itemApi';
import { CreateItemPayload, UpdateItemPayload } from '../types/item';

export function useItems(workspaceId: string, containerId: string, includeArchived = false) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['items', workspaceId, containerId, includeArchived],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return getItemsByContainer(workspaceId, containerId, token, includeArchived);
    },
    enabled: !!workspaceId && !!containerId,
  });
}

export function useCreateItem(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateItemPayload) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return createItem(workspaceId, containerId, payload, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId, containerId] });
    },
  });
}

export function useUpdateItem(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, payload }: { itemId: string; payload: UpdateItemPayload }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return updateItem(workspaceId, itemId, payload, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId, containerId] });
    },
  });
}

export function useArchiveItem(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return archiveItem(workspaceId, itemId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId, containerId] });
    },
  });
}

export function useRestoreItem(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return restoreItem(workspaceId, itemId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId, containerId] });
    },
  });
}
