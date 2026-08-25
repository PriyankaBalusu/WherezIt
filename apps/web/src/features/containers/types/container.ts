export interface Container {
  id: string;
  workspaceId: string;
  storageNodeId: string;
  boxNumber: number;
  boxId: string;
  name?: string | null;
  description?: string | null;
  physicalLabel?: string | null;
  isArchived: boolean;
  destinationStorageNodeId?: string | null;
  isPacked?: boolean;
  movingPriority?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContainerRequest {
  storageNodeId: string;
  name?: string;
  description?: string;
  physicalLabel?: string;
  destinationStorageNodeId?: string;
  isPacked?: boolean;
  movingPriority?: string;
}

export interface UpdateContainerRequest {
  name?: string;
  description?: string;
  physicalLabel?: string | null;
  destinationStorageNodeId?: string | null;
  isPacked?: boolean;
  movingPriority?: string | null;
}
