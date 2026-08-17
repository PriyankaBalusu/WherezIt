export interface Item {
  id: string;
  workspaceId: string;
  containerId: string;
  name: string;
  quantity: number;
  source: 'MANUAL' | 'AI_CONFIRMED';
  isVerified: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemPayload {
  name: string;
  quantity?: number;
}

export interface UpdateItemPayload {
  name?: string;
  quantity?: number;
}
