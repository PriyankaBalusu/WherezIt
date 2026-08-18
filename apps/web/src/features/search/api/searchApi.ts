import { getIdToken } from 'firebase/auth';
import { auth } from '../../../config/firebase';

export interface SearchResult {
  resultType: 'ITEM' | 'CONTAINER';
  itemId?: string | null;
  itemName?: string | null;
  quantity?: number | null;
  containerId: string;
  boxNumber: number;
  boxDisplayId: string;
  locationId?: string | null;
  locationName?: string | null;
  breadcrumb: string[];
  breadcrumbDisplay: string;
}

export async function searchWorkspace(workspaceId: string, query: string): Promise<SearchResult[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to search workspace.');
  }

  const token = await getIdToken(currentUser);
  const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/search?q=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Search failed with status ${response.status}`);
  }

  return response.json();
}
