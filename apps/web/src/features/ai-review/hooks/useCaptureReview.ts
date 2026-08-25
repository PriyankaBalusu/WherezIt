import { useQuery } from '@tanstack/react-query';
import { fetchCaptureReview, CaptureReviewResponse } from '../api/captureReviewApi';

export function useCaptureReview(workspaceId: string, captureId: string) {
  return useQuery<CaptureReviewResponse, Error>({
    queryKey: ['captureReview', workspaceId, captureId],
    queryFn: () => fetchCaptureReview(workspaceId, captureId),
    enabled: Boolean(workspaceId) && Boolean(captureId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'PROCESSING' || data?.status === 'QUEUED') {
        return 1500; // Poll every 1.5s while photo analysis is queued/processing
      }
      return false; // Stop polling when REVIEW_REQUIRED, CONFIRMED, or FAILED
    },
  });
}
