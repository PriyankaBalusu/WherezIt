import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  fetchLocations,
  createLocation,
  renameLocation,
  deleteLocation,
  moveLocation,
} from '../api/locationApi';
import {
  CreateStorageLocationRequest,
  RenameStorageLocationRequest,
  MoveStorageLocationRequest,
} from '../types/location';

export function useStorageLocations(workspaceId: string | undefined) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['locations', workspaceId],
    queryFn: () => fetchLocations(workspaceId!, getIdToken),
    enabled: !!workspaceId,
  });
}

export function useCreateStorageLocation(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStorageLocationRequest) => createLocation(workspaceId, data, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', workspaceId] });
    },
  });
}

export function useRenameStorageLocation(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, data }: { locationId: string; data: RenameStorageLocationRequest }) =>
      renameLocation(workspaceId, locationId, data, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', workspaceId] });
    },
  });
}

export function useDeleteStorageLocation(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (locationId: string) => deleteLocation(workspaceId, locationId, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', workspaceId] });
    },
  });
}

export function useMoveStorageLocation(workspaceId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, data }: { locationId: string; data: MoveStorageLocationRequest }) =>
      moveLocation(workspaceId, locationId, data, getIdToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', workspaceId] });
    },
  });
}
