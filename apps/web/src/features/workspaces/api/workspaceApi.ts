import { Workspace, CreateWorkspaceRequest } from '../types/workspace';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';

export async function fetchWorkspaces(getIdToken: () => Promise<string | null>): Promise<Workspace[]> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('User is not authenticated.');
  }

  const response = await fetch(`${API_BASE_URL}/workspaces`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
  }

  return response.json();
}

export async function createWorkspace(
  data: CreateWorkspaceRequest,
  getIdToken: () => Promise<string | null>
): Promise<Workspace> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('User is not authenticated.');
  }

  const response = await fetch(`${API_BASE_URL}/workspaces`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create workspace: ${response.statusText}`);
  }

  return response.json();
}

export async function renameWorkspace(
  workspaceId: string,
  name: string,
  getIdToken: () => Promise<string | null>
): Promise<Workspace> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to rename workspace.`);
  }

  return response.json();
}

export async function deleteWorkspace(
  workspaceId: string,
  getIdToken: () => Promise<string | null>
): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete workspace.`);
  }
}
