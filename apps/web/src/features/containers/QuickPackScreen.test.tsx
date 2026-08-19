import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QuickPackScreen } from './QuickPackScreen';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    getIdToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));

vi.mock('../locations/hooks/useStorageLocations', () => ({
  useStorageLocations: () => ({
    data: [
      { id: 'loc-1', name: 'Garage', parentId: null },
      { id: 'loc-2', name: 'Attic', parentId: null },
    ],
    isLoading: false,
  }),
}));

vi.mock('./api/containerApi', () => ({
  createContainer: vi.fn().mockResolvedValue({
    id: 'cont-999',
    workspaceId: 'ws-1',
    storageNodeId: 'loc-1',
    boxNumber: 10,
    boxDisplayId: 'BOX 010',
    name: 'Quick Box',
    description: 'Quick Desc',
    isArchived: false,
    destinationStorageNodeId: 'loc-2',
    isPacked: true,
    movingPriority: 'HIGH',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
}));

describe('QuickPackScreen (MOV-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quick pack form with locations and creates container with moving metadata', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          <Route path="/workspaces/:workspaceId/containers/:containerId" element={<div>Container Detail View</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Quick Pack Container')).toBeInTheDocument();
    expect(screen.getByLabelText(/Current Storage Location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Intended Destination Room/i)).toBeInTheDocument();

    // Select locations and fill container details
    fireEvent.change(screen.getByLabelText(/Current Storage Location/i), { target: { value: 'loc-1' } });
    fireEvent.change(screen.getByLabelText(/Intended Destination Room/i), { target: { value: 'loc-2' } });
    fireEvent.change(screen.getByLabelText(/Container Name/i), { target: { value: 'Quick Box' } });
    fireEvent.click(screen.getByLabelText(/Mark as Packed/i));
    fireEvent.change(screen.getByLabelText(/Moving Priority/i), { target: { value: 'HIGH' } });

    // Submit form without photo
    fireEvent.click(screen.getByRole('button', { name: /Save Container/i }));

    await waitFor(() => {
      expect(screen.getByText('Container Detail View')).toBeInTheDocument();
    });
  });
});
