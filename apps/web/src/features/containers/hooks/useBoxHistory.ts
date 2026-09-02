import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';

export interface BoxHistoryItem {
  id: string;
  activityType: string;
  title: string;
  description: string;
  containerId: string;
  workspaceId: string;
  actorUserId: string;
  occurredAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';

export function useBoxHistory(workspaceId?: string, containerId?: string, page: number = 1, pageSize: number = 10) {
  const { getIdToken } = useAuth();

  return useQuery<BoxHistoryItem[]>({
    queryKey: ['boxHistory', workspaceId, containerId, page, pageSize],
    queryFn: async () => {
      if (!workspaceId || !containerId) return [];
      const token = await getIdToken();
      if (!token) return [];

      const res = await fetch(
        `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/history?page=${page}&pageSize=${pageSize}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        throw new Error('Failed to load box history.');
      }
      return res.json();
    },
    enabled: Boolean(workspaceId && containerId),
  });
}

export function useWorkspaceHistory(workspaceId?: string, page: number = 1, pageSize: number = 10) {
  const { getIdToken } = useAuth();

  return useQuery<BoxHistoryItem[]>({
    queryKey: ['workspaceHistory', workspaceId, page, pageSize],
    queryFn: async () => {
      if (!workspaceId) return [];
      const token = await getIdToken();
      if (!token) return [];

      const res = await fetch(
        `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/history?page=${page}&pageSize=${pageSize}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        throw new Error('Failed to load workspace history.');
      }
      return res.json();
    },
    enabled: Boolean(workspaceId),
  });
}

export function useLocationHistory(workspaceId?: string, locationId?: string, page: number = 1, pageSize: number = 10) {
  const { getIdToken } = useAuth();

  return useQuery<BoxHistoryItem[]>({
    queryKey: ['locationHistory', workspaceId, locationId, page, pageSize],
    queryFn: async () => {
      if (!workspaceId || !locationId) return [];
      const token = await getIdToken();
      if (!token) return [];

      const res = await fetch(
        `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/locations/${encodeURIComponent(locationId)}/history?page=${page}&pageSize=${pageSize}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        throw new Error('Failed to load location history.');
      }
      return res.json();
    },
    enabled: Boolean(workspaceId && locationId),
  });
}
