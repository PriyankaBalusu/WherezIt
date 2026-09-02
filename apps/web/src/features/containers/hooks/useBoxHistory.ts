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

export function useBoxHistory(workspaceId?: string, containerId?: string) {
  const { getIdToken } = useAuth();

  return useQuery<BoxHistoryItem[]>({
    queryKey: ['boxHistory', workspaceId, containerId],
    queryFn: async () => {
      if (!workspaceId || !containerId) return [];
      const token = await getIdToken();
      if (!token) return [];

      const res = await fetch(
        `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/history`,
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
