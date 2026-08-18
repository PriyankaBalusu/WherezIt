import { ImageUploadResponse } from '../types/image';

export async function uploadContainerImage(
  workspaceId: string,
  containerId: string,
  file: File,
  token: string
): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/containers/${containerId}/images`,
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
