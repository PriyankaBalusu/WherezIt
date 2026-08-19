export interface Item {
  id: string;
  workspaceId: string;
  containerId: string;
  name: string;
  quantity: number;
  category?: string | null;
  source: 'MANUAL' | 'AI_CONFIRMED';
  isVerified: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemPayload {
  name: string;
  quantity?: number;
  category?: string;
}

export interface UpdateItemPayload {
  name?: string;
  quantity?: number;
  category?: string | null;
}
