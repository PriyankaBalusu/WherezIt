import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import { getContainerImages, deleteContainerImage, uploadContainerImage } from '../api/containerImageApi';

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
