import {
  StorageLocation,
  CreateStorageLocationRequest,
  RenameStorageLocationRequest,
  MoveStorageLocationRequest,
} from '../types/location';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5056/api/v1';

export async function fetchLocations(
  workspaceId: string,
  getIdToken: () => Promise<string | null>
): Promise<StorageLocation[]> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/locations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch locations: ${response.statusText}`);
  }

  return response.json();
}

export async function createLocation(
  workspaceId: string,
  data: CreateStorageLocationRequest,
  getIdToken: () => Promise<string | null>
): Promise<StorageLocation> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/locations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create location: ${response.statusText}`);
  }

  return response.json();
}

export async function renameLocation(
  workspaceId: string,
  locationId: string,
  data: RenameStorageLocationRequest,
  getIdToken: () => Promise<string | null>
): Promise<StorageLocation> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/locations/${locationId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to rename location: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteLocation(
  workspaceId: string,
  locationId: string,
  getIdToken: () => Promise<string | null>
): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/locations/${locationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete location: ${response.statusText}`);
  }
}

export async function moveLocation(
  workspaceId: string,
  locationId: string,
  data: MoveStorageLocationRequest,
  getIdToken: () => Promise<string | null>
): Promise<StorageLocation> {
  const token = await getIdToken();
  if (!token) throw new Error('User is not authenticated.');

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/locations/${locationId}/move`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to move location: ${response.statusText}`);
  }

  return response.json();
}
