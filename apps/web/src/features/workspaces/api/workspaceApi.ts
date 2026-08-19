import { Workspace, CreateWorkspaceRequest } from '../types/workspace';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5056/api/v1';

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
