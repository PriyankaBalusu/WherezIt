import { ImageUploadResponse } from '../types/image';
import { API_BASE_URL } from '../../../config/api';

export async function uploadContainerImage(
  workspaceId: string,
  containerId: string,
  file: File,
  token: string
): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/images`,
    {

      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  return response.json();
}
