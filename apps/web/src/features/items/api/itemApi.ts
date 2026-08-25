import { Item, CreateItemPayload, UpdateItemPayload } from '../types/item';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';

export async function getItemsByContainer(
  workspaceId: string,
  containerId: string,
  token: string,
  includeArchived = false
): Promise<Item[]> {
  const url = `${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/items?includeArchived=${includeArchived}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch items: ${res.statusText}`);
  }
  return res.json();
}

export async function createItem(
  workspaceId: string,
  containerId: string,
  payload: CreateItemPayload,
  token: string
): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create item: ${res.statusText}`);
  }
  return res.json();
}

export async function updateItem(
  workspaceId: string,
  itemId: string,
  payload: UpdateItemPayload,
  token: string
): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update item: ${res.statusText}`);
  }
  return res.json();
}

export async function archiveItem(
  workspaceId: string,
  itemId: string,
  token: string
): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/items/${itemId}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to archive item: ${res.statusText}`);
  }
  return res.json();
}

export async function restoreItem(
  workspaceId: string,
  itemId: string,
  token: string
): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/items/${itemId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to restore item: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteItem(
  workspaceId: string,
  itemId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/items/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete item: ${res.statusText}`);
  }
}
