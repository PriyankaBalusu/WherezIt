import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StorageSpaceDetailPage } from './StorageSpaceDetailPage';

const mockSetActiveWorkspaceId = vi.fn();

vi.mock('../context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaces: [
      { id: 'ws-a', name: 'Storage Space A', role: 'OWNER' },
      { id: 'ws-b', name: 'Storage Space B', role: 'OWNER' },
    ],
    activeWorkspace: { id: 'ws-a', name: 'Storage Space A', role: 'OWNER' },
    setActiveWorkspaceId: mockSetActiveWorkspaceId,
  }),
}));

vi.mock('../../locations/hooks/useStorageLocations', () => ({
  useStorageLocations: (workspaceId: string) => {
    if (workspaceId === 'ws-b') {
      return {
        data: [{ id: 'loc-b1', name: 'Basement Rack 1', parentId: null }],
        isLoading: false,
      };
    }
    return {
      data: [{ id: 'loc-a1', name: 'Garage Shelf 1', parentId: null }],
      isLoading: false,
    };
  },
  useCreateStorageLocation: () => ({ mutateAsync: vi.fn() }),
  useRenameStorageLocation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../containers/hooks/useContainers', () => ({
  useContainers: (workspaceId: string) => {
    if (workspaceId === 'ws-b') {
      return {
        data: [
          {
            id: 'box-b1',
            boxNumber: 12,
            boxDisplayId: 'BOX 012',
            name: 'Winter Clothes',
            workspaceId: 'ws-b',
            storageNodeId: 'loc-b1',
            isArchived: false,
          },
        ],
        isLoading: false,
      };
    }
    return {
      data: [
        {
          id: 'box-a1',
          boxNumber: 1,
          boxDisplayId: 'BOX 001',
          name: 'Summer Tools',
          workspaceId: 'ws-a',
          storageNodeId: 'loc-a1',
          isArchived: false,
        },
      ],
      isLoading: false,
    };
  },
  useCreateContainer: () => ({ mutateAsync: vi.fn() }),
}));

describe('StorageSpaceDetailPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.resetAllMocks();
  });

  const renderComponent = (workspaceId = 'ws-b') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/workspaces/${workspaceId}`]}>
          <Routes>
            <Route path="/workspaces/:workspaceId" element={<StorageSpaceDetailPage />} />
            <Route path="/" element={<div>Home Screen</div>} />
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<div>Container Detail Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders workspace name, authorized locations, and boxes for specified workspaceId', async () => {
    renderComponent('ws-b');

    expect(await screen.findByRole('heading', { name: /Storage Space B/i })).toBeInTheDocument();
    expect(screen.getByText('Basement Rack 1')).toBeInTheDocument();
    expect(screen.getByText('Winter Clothes')).toBeInTheDocument();
  });

  it('visiting Workspace B detail page does NOT mutate Home active workspace state', async () => {
    renderComponent('ws-b');

    await screen.findByRole('heading', { name: /Storage Space B/i });
    expect(mockSetActiveWorkspaceId).not.toHaveBeenCalled();
  });

  it('clicking a box on the Storage Space page opens Box Detail using that workspaceId', async () => {
    renderComponent('ws-b');

    const boxCard = await screen.findByText('Winter Clothes');
    fireEvent.click(boxCard);

    expect(await screen.findByText('Container Detail Page')).toBeInTheDocument();
  });

  it('displays locations for workspace B without showing empty state or locations from workspace A', async () => {
    renderComponent('ws-b');

    expect(await screen.findByText('Basement Rack 1')).toBeInTheDocument();
    expect(screen.queryByText('Garage Shelf 1')).not.toBeInTheDocument();
    expect(screen.queryByText(/No locations added yet/i)).not.toBeInTheDocument();
  });

  it('displays neutral empty state when workspace has zero storage locations', async () => {
    renderComponent('ws-empty');

    expect(await screen.findByText('No storage locations found.')).toBeInTheDocument();
    expect(screen.queryByText(/Click "\+ Add Location"/i)).not.toBeInTheDocument();
  });

  it('does NOT render Add Location or location action menu on the read-only Storage Space page', async () => {
    renderComponent('ws-b');

    await screen.findByText('Basement Rack 1');
    expect(screen.queryByRole('button', { name: /\+ Location/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Location actions')).not.toBeInTheDocument();
  });
});
