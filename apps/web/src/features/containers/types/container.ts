export interface Container {
  id: string;
  workspaceId: string;
  storageNodeId: string;
  boxNumber: number;
  boxId: string;
  name?: string | null;
  description?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContainerRequest {
  storageNodeId: string;
  name?: string;
  description?: string;
}

export interface UpdateContainerRequest {
  name?: string;
  description?: string;
}
