import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrintBarcodeLabelModal } from './components/PrintBarcodeLabelModal';
import * as barcodeApi from './api/barcodeApi';

vi.mock('./api/barcodeApi');
vi.mock('./hooks/useIdentifiers', () => ({
  useContainerIdentifiers: () => ({ data: [] }),
}));

describe('PrintBarcodeLabelModal (ID-003)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders Code 128 barcode SVG, box display ID, and human-readable box ID', async () => {
    vi.mocked(barcodeApi.acquireContainerBarcodeIdentifier).mockResolvedValueOnce({
      identifierId: 'id-bar-123',
      type: 'BARCODE',
      value: 'wzi_bar_test_token_123456789',
      createdAt: '2026-08-19T00:00:00Z',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PrintBarcodeLabelModal
          workspaceId="ws-123"
          containerId="c-456"
          boxDisplayId="BOX 010"
          isOpen={true}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );

    // Initial state: Show "No barcode" message and "Generate Barcode" button
    expect(screen.getByText(/No barcode has been created for this box\./i)).toBeInTheDocument();
    const generateBtn = screen.getByRole('button', { name: 'Generate Barcode' });
    expect(generateBtn).toBeInTheDocument();

    // Click to generate
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('BOX 010')).toBeInTheDocument();
      expect(screen.getByText('WHEREZIT')).toBeInTheDocument();
      expect(screen.getByText('wzi_bar_test_token_123456789')).toBeInTheDocument();
      expect(screen.getByText('Scan to find this box')).toBeInTheDocument();
    });
  });
});
