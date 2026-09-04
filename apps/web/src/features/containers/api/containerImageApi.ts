const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';

export interface ContainerImage {
  id: string;
  workspaceId: string;
  containerId: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export async function getContainerImages(
  workspaceId: string,
  containerId: string,
  token: string
): Promise<ContainerImage[]> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/images`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch container photos: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteContainerImage(
  workspaceId: string,
  containerId: string,
  imageId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/images/${imageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete photo: ${res.statusText}`);
  }
}

export async function uploadContainerImage(
  workspaceId: string,
  containerId: string,
  file: File,
  token: string
): Promise<ContainerImage> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to upload photo: ${res.statusText}`);
  }

  return res.json();
}

export async function getPhysicalLabelImage(
  workspaceId: string,
  containerId: string,
  token: string
): Promise<ContainerImage | null> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/physical-label-image`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204 || res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch physical label photo: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadPhysicalLabelImage(
  workspaceId: string,
  containerId: string,
  file: File,
  token: string
): Promise<ContainerImage> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/physical-label-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to upload physical label photo: ${res.statusText}`);
  }

  return res.json();
}

export async function deletePhysicalLabelImage(
  workspaceId: string,
  containerId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/physical-label-image`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete physical label photo: ${res.statusText}`);
  }
}

export async function deleteExistingLabel(
  workspaceId: string,
  containerId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/existing-label`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to remove existing label: ${res.statusText}`);
  }
}

export async function extractPhysicalLabelOcrText(
  workspaceId: string,
  containerId: string,
  token: string
): Promise<{ detectedText: string | null }> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/containers/${containerId}/physical-label-image/ocr`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { detectedText: null };
  }
  return res.json();
}
