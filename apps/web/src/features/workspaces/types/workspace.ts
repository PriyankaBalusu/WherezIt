export type WorkspaceRole = 'OWNER' | 'MEMBER';

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
  inventoryNamespaceId: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  inventoryNamespaceId?: string;
}
