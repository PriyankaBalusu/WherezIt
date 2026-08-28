import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GlobalScanScreen } from './components/GlobalScanScreen';
import * as identifierApi from './api/identifierApi';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    getIdToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));

vi.mock('./api/identifierApi');

vi.mock('../workspaces/context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    activeWorkspace: { id: 'ws-123', name: 'Test WS' },
    setActiveWorkspaceId: vi.fn(),
  }),
}));

describe('GlobalScanScreen (ID-002 Scanner Extraction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders GlobalScanScreen badge and title, and contains manual lookup inputs', async () => {
    render(
      <MemoryRouter>
        <GlobalScanScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('GLOBAL SCAN')).toBeInTheDocument();
    expect(screen.getByText('Scan a Code')).toBeInTheDocument();
    expect(screen.getByLabelText(/Enter Code Manually/i)).toBeInTheDocument();
  });

  it('submits manual code lookup and navigates to resolved container detail page', async () => {
    vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
      containerId: 'cont-777',
      workspaceId: 'ws-123',
      boxNumber: 5,
      boxDisplayId: 'BOX 005',
      storageNodeId: 'loc-1',
      locationName: 'Shelf 1',
      breadcrumbDisplay: 'Garage → Shelf 1',
      items: [],
    });

    render(
      <MemoryRouter initialEntries={['/scan']}>
        <Routes>
          <Route path="/scan" element={<GlobalScanScreen />} />
          <Route path="/workspaces/:workspaceId/containers/:containerId" element={<div>Container Details View</div>} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Enter Code Manually/i);
    fireEvent.change(input, { target: { value: 'wzi_qr_777' } });

    const btn = screen.getByRole('button', { name: 'Find Box' });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(identifierApi.resolveContainerIdentifier).toHaveBeenCalledWith('wzi_qr_777');
      expect(screen.getByText('Container Details View')).toBeInTheDocument();
    });
  });
});
