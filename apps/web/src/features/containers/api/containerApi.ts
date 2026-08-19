import { Container, CreateContainerRequest, UpdateContainerRequest } from '../types/container';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5056/api/v1';

export async function fetchContainers(
  workspaceId: string,
  getIdToken: () => Promise<string | null>,
  storageNodeId?: string,
  includeArchived: boolean = false
): Promise<Container[]> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const params = new URLSearchParams();
  if (storageNodeId) params.append('storageNodeId', storageNodeId);
  if (includeArchived) params.append('includeArchived', 'true');

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers${queryString}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch containers: ${response.statusText}`);
  }

  return response.json();
}

export async function createContainer(
  workspaceId: string,
  data: CreateContainerRequest,
  getIdToken: () => Promise<string | null>
): Promise<Container> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create container: ${response.statusText}`);
  }

  return response.json();
}

export async function updateContainer(
  workspaceId: string,
  containerId: string,
  data: UpdateContainerRequest,
  getIdToken: () => Promise<string | null>
): Promise<Container> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update container: ${response.statusText}`);
  }

  return response.json();
}

export async function archiveContainer(
  workspaceId: string,
  containerId: string,
  getIdToken: () => Promise<string | null>
): Promise<Container> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/archive`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to archive container: ${response.statusText}`);
  }

  return response.json();
}

export async function restoreContainer(
  workspaceId: string,
  containerId: string,
  getIdToken: () => Promise<string | null>
): Promise<Container> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/restore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to restore container: ${response.statusText}`);
  }

  return response.json();
}
