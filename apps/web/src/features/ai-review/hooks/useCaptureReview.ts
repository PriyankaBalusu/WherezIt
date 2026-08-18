import { useQuery } from '@tanstack/react-query';
import { fetchCaptureReview, CaptureReviewResponse } from '../api/captureReviewApi';

export function useCaptureReview(workspaceId: string, captureId: string) {
  return useQuery<CaptureReviewResponse, Error>({
    queryKey: ['captureReview', workspaceId, captureId],
    queryFn: () => fetchCaptureReview(workspaceId, captureId),
    enabled: Boolean(workspaceId) && Boolean(captureId),
  });
}
