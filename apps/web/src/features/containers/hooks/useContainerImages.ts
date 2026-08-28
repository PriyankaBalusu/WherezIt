import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  getContainerImages,
  deleteContainerImage,
  uploadContainerImage,
  getPhysicalLabelImage,
  uploadPhysicalLabelImage,
  deletePhysicalLabelImage,
  deleteExistingLabel,
} from '../api/containerImageApi';

export function useContainerImages(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['containerImages', workspaceId, containerId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return getContainerImages(workspaceId, containerId, token);
    },
    enabled: !!workspaceId && !!containerId,
  });
}

export function useDeleteContainerImage(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return deleteContainerImage(workspaceId, containerId, imageId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerImages', workspaceId, containerId] });
    },
  });
}

export function useUploadContainerImage(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return uploadContainerImage(workspaceId, containerId, file, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerImages', workspaceId, containerId] });
    },
  });
}

export function usePhysicalLabelImage(workspaceId?: string, containerId?: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['physicalLabelImage', workspaceId, containerId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return getPhysicalLabelImage(workspaceId!, containerId!, token);
    },
    enabled: !!workspaceId && !!containerId,
  });
}

export function useUploadPhysicalLabelImage(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return uploadPhysicalLabelImage(workspaceId, containerId, file, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physicalLabelImage', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });
    },
  });
}

export function useDeletePhysicalLabelImage(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return deletePhysicalLabelImage(workspaceId, containerId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physicalLabelImage', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });
    },
  });
}

export function useDeleteExistingLabel(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Unauthenticated');
      return deleteExistingLabel(workspaceId, containerId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physicalLabelImage', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });
    },
  });
}
