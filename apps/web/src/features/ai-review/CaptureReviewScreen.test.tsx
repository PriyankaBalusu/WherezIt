import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CaptureReviewScreen } from './components/CaptureReviewScreen';
import * as captureReviewApi from './api/captureReviewApi';

vi.mock('./api/captureReviewApi');

describe('CaptureReviewScreen (AI-004 & AI-005)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (workspaceId = 'ws-123', captureId = 'cap-456', onNavigateToManualEntry = vi.fn(), onConfirmSuccess = vi.fn()) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CaptureReviewScreen
          workspaceId={workspaceId}
          captureId={captureId}
          onNavigateToManualEntry={onNavigateToManualEntry}
          onConfirmSuccess={onConfirmSuccess}
        />
      </QueryClientProvider>
    );
  };

  it('renders review suggestions and allows client-side editing and explicit confirmation', async () => {
    const mockReview: captureReviewApi.CaptureReviewResponse = {
      captureId: 'cap-456',
      workspaceId: 'ws-123',
      containerId: 'box-7',
      boxNumber: 7,
      boxDisplayId: 'BOX 007',
      imageId: 'img-888',
      status: 'REVIEW_REQUIRED',
      breadcrumbDisplay: 'Garage → Shelf 1',
      suggestions: [
        { id: 'sugg-1', suggestedName: 'String Lights', suggestedQuantity: 2, confidenceScore: 0.95 },
        { id: 'sugg-2', suggestedName: 'Extension Cord', suggestedQuantity: 1, confidenceScore: 0.88 },
      ],
    };

    vi.mocked(captureReviewApi.fetchCaptureReview).mockResolvedValueOnce(mockReview);
    vi.mocked(captureReviewApi.confirmCaptureReview).mockResolvedValueOnce({
      captureId: 'cap-456',
      workspaceId: 'ws-123',
      containerId: 'box-7',
      status: 'CONFIRMED',
      confirmedItemsCount: 2,
    });

    const handleConfirmSuccess = vi.fn();
    renderComponent('ws-123', 'cap-456', vi.fn(), handleConfirmSuccess);

    await waitFor(() => {
      expect(screen.getByDisplayValue('String Lights')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Extension Cord')).toBeInTheDocument();
    });

    // Rename
    const nameInput = screen.getByDisplayValue('String Lights');
    fireEvent.change(nameInput, { target: { value: 'LED String Lights' } });
    expect(screen.getByDisplayValue('LED String Lights')).toBeInTheDocument();

    // Confirm inventory click
    const confirmBtn = screen.getByRole('button', { name: /Confirm Inventory/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(captureReviewApi.confirmCaptureReview).toHaveBeenCalledWith('ws-123', 'cap-456', [
        { name: 'LED String Lights', quantity: 2, suggestionId: 'sugg-1' },
        { name: 'Extension Cord', quantity: 1, suggestionId: 'sugg-2' },
      ]);
      expect(handleConfirmSuccess).toHaveBeenCalledWith('box-7');
    });
  });

  it('renders processing state when capture is still in progress', async () => {
    const mockReview: captureReviewApi.CaptureReviewResponse = {
      captureId: 'cap-456',
      workspaceId: 'ws-123',
      containerId: 'box-7',
      boxNumber: 7,
      boxDisplayId: 'BOX 007',
      imageId: 'img-888',
      status: 'PROCESSING',
      breadcrumbDisplay: 'Garage → Shelf 1',
      suggestions: [],
    };

    vi.mocked(captureReviewApi.fetchCaptureReview).mockResolvedValueOnce(mockReview);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/AI Processing in Progress/i)).toBeInTheDocument();
    });
  });

  it('renders failure state and navigation to manual inventory entry', async () => {
    const mockReview: captureReviewApi.CaptureReviewResponse = {
      captureId: 'cap-456',
      workspaceId: 'ws-123',
      containerId: 'box-7',
      boxNumber: 7,
      boxDisplayId: 'BOX 007',
      imageId: 'img-888',
      status: 'FAILED',
      breadcrumbDisplay: 'Garage → Shelf 1',
      failureReason: 'Image too blurry',
      suggestions: [],
    };

    const mockNav = vi.fn();
    vi.mocked(captureReviewApi.fetchCaptureReview).mockResolvedValueOnce(mockReview);

    renderComponent('ws-123', 'cap-456', mockNav);

    await waitFor(() => {
      expect(screen.getByText(/AI Processing Failed/i)).toBeInTheDocument();
    });

    const manualBtn = screen.getByRole('button', { name: /Go to Manual Item Entry/i });
    fireEvent.click(manualBtn);
    expect(mockNav).toHaveBeenCalledWith('box-7');
  });
});
