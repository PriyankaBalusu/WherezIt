import { getIdToken } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { API_BASE_URL } from '../../../config/api';

export interface BarcodeIdentifierResponse {
  identifierId: string;
  type: string;
  value: string;
  createdAt: string;
}

export async function acquireContainerBarcodeIdentifier(
  workspaceId: string,
  containerId: string
): Promise<BarcodeIdentifierResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated user');
  const token = await getIdToken(user);

  const res = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/identifiers/barcode`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );


  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to acquire barcode identifier');
  }

  return res.json();
}
