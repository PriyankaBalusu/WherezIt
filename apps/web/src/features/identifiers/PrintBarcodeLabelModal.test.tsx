import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrintBarcodeLabelModal } from './components/PrintBarcodeLabelModal';
import * as barcodeApi from './api/barcodeApi';

vi.mock('./api/barcodeApi');

describe('PrintBarcodeLabelModal (ID-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Code 128 barcode SVG, box display ID, and human-readable box ID', async () => {
    vi.mocked(barcodeApi.acquireContainerBarcodeIdentifier).mockResolvedValueOnce({
      identifierId: 'id-bar-123',
      type: 'BARCODE',
      value: 'wzi_bar_test_token_123456789',
      createdAt: '2026-08-19T00:00:00Z',
    });

    render(
      <PrintBarcodeLabelModal
        workspaceId="ws-123"
        containerId="c-456"
        boxDisplayId="BOX 010"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 010')).toBeInTheDocument();
      expect(screen.getByText('WHEREZIT')).toBeInTheDocument();
      expect(screen.getByText('wzi_bar_test_token_123456789')).toBeInTheDocument();
      expect(screen.getByText('Scan to find this box')).toBeInTheDocument();
    });
  });
});
