import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/context/AuthContext';
import { uploadContainerImage } from '../api/imageApi';

export function useImageUpload(workspaceId: string, containerId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return uploadContainerImage(workspaceId, containerId, file, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['images', workspaceId] });
    },
  });
}
