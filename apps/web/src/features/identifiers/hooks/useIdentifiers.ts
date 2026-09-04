import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchContainerIdentifiers,
  attachContainerIdentifier,
  revokeIdentifier,
  ContainerIdentifierItem,
} from '../api/identifierApi';

export function useContainerIdentifiers(workspaceId: string | undefined, containerId: string | undefined) {
  return useQuery<ContainerIdentifierItem[]>({
    queryKey: ['containerIdentifiers', workspaceId, containerId],
    queryFn: () => fetchContainerIdentifiers(workspaceId!, containerId!),
    enabled: !!workspaceId && !!containerId,
  });
}

export function useAttachIdentifier(workspaceId: string, containerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, value }: { type: 'QR' | 'BARCODE'; value: string }) =>
      attachContainerIdentifier(workspaceId, containerId, type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerIdentifiers', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });
    },
  });
}

export function useRevokeIdentifier(workspaceId: string, containerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (identifierId: string) => revokeIdentifier(workspaceId, identifierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerIdentifiers', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
    },
  });
}

