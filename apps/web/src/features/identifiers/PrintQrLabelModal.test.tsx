import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrintQrLabelModal } from './components/PrintQrLabelModal';
import * as identifierApi from './api/identifierApi';

vi.mock('./api/identifierApi');

describe('PrintQrLabelModal (ID-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  it('acquires and renders QR label with canonical BOX display ID and scan instruction', async () => {
    vi.mocked(identifierApi.acquireContainerQrIdentifier).mockResolvedValueOnce({
      identifierId: 'id-111',
      type: 'QR',
      value: 'wzi_qr_testtoken123',
      createdAt: new Date().toISOString(),
    });

    const handleClose = vi.fn();
    render(
      <PrintQrLabelModal
        workspaceId="ws-1"
        containerId="box-4"
        boxDisplayId="BOX 004"
        onClose={handleClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 004')).toBeInTheDocument();
      expect(screen.getByText('Scan to find this box')).toBeInTheDocument();
      expect(screen.getByText('WHEREZIT')).toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', { name: /Print Label/i });
    fireEvent.click(printBtn);
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
