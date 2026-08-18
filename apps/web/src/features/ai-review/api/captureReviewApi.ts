import { getIdToken } from 'firebase/auth';
import { auth } from '../../../config/firebase';

export interface DetectionSuggestion {
  id: string;
  suggestedName: string;
  suggestedQuantity: number;
  confidenceScore: number;
}

export interface CaptureReviewResponse {
  captureId: string;
  workspaceId: string;
  containerId: string;
  boxNumber: number;
  boxDisplayId: string;
  imageId: string;
  status: 'PROCESSING' | 'FAILED' | 'REVIEW_REQUIRED' | 'CONFIRMED';
  breadcrumbDisplay: string;
  failureReason?: string | null;
  suggestions: DetectionSuggestion[];
}

export async function fetchCaptureReview(workspaceId: string, captureId: string): Promise<CaptureReviewResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to view capture review.');
  }

  const token = await getIdToken(currentUser);
  const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/captures/${encodeURIComponent(captureId)}/review`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch capture review with status ${response.status}`);
  }

  return response.json();
}

export interface ConfirmItemPayload {
  name: string;
  quantity: number;
  suggestionId?: string;
}

export interface ConfirmCaptureResponse {
  captureId: string;
  workspaceId: string;
  containerId: string;
  status: string;
  confirmedItemsCount: number;
}

export async function confirmCaptureReview(
  workspaceId: string,
  captureId: string,
  items: ConfirmItemPayload[]
): Promise<ConfirmCaptureResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to confirm capture review.');
  }

  const token = await getIdToken(currentUser);
  const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/captures/${encodeURIComponent(captureId)}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Confirmation failed with status ${response.status}`);
  }

  return response.json();
}
