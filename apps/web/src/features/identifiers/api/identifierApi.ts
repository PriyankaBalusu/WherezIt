import { getIdToken } from 'firebase/auth';
import { auth } from '../../../config/firebase';

export interface QrIdentifierResponse {
  identifierId: string;
  type: string;
  value: string;
  createdAt: string;
}

export interface ResolvedContainerItem {
  itemId: string;
  name: string;
  quantity: number;
}

export interface ResolvedContainerResponse {
  containerId: string;
  workspaceId: string;
  boxNumber: number;
  boxDisplayId: string;
  storageNodeId: string;
  locationName: string;
  breadcrumbDisplay: string;
  items: ResolvedContainerItem[];
}

export async function acquireContainerQrIdentifier(
  workspaceId: string,
  containerId: string
): Promise<QrIdentifierResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to acquire QR identifier.');
  }

  const token = await getIdToken(currentUser);
  const response = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/identifiers/qr`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to acquire QR label with status ${response.status}`);
  }

  return response.json();
}

export async function resolveContainerIdentifier(value: string): Promise<ResolvedContainerResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to resolve container identifier.');
  }

  const token = await getIdToken(currentUser);
  const response = await fetch(`/api/v1/identifiers/resolve?value=${encodeURIComponent(value)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Container not found or unavailable.`);
  }

  return response.json();
}
