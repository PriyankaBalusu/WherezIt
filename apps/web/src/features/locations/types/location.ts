export interface StorageLocation {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStorageLocationRequest {
  name: string;
  parentId?: string | null;
}

export interface RenameStorageLocationRequest {
  name: string;
}

export interface MoveStorageLocationRequest {
  parentId: string | null;
}
