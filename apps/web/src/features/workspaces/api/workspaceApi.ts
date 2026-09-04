import { Workspace, CreateWorkspaceRequest } from '../types/workspace';
import { API_BASE_URL } from '../../../config/api';

export interface WorkspaceAudit {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inventoryNamespaceId: string;
  eventType: 'WORKSPACE_CREATED' | 'WORKSPACE_RENAMED' | 'WORKSPACE_DELETED' | 'LOCATION_CREATED' | 'LOCATION_RENAMED' | 'LOCATION_DELETED' | string;
  actorUserId: string;
  occurredAt: string;
  detailsJson?: string | null;
}

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

export async function leaveWorkspace(
  workspaceId: string,
  getIdToken: () => Promise<string | null>
): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/leave`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to leave workspace.`);
  }
}

export async function fetchWorkspaceAudits(getIdToken: () => Promise<string | null>): Promise<WorkspaceAudit[]> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/audits`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspace lifecycle activity.`);
  }

  return response.json();
}
