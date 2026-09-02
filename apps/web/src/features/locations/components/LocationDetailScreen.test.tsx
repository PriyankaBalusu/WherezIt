import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocationDetailScreen } from './LocationDetailScreen';

const mockSetActiveWorkspaceId = vi.fn();

vi.mock('../../workspaces/context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaces: [
      { id: 'ws-a', name: 'Storage Space A', role: 'OWNER' },
      { id: 'ws-b', name: 'Storage Space B', role: 'OWNER' },
    ],
    activeWorkspace: { id: 'ws-a', name: 'Storage Space A', role: 'OWNER' },
    setActiveWorkspaceId: mockSetActiveWorkspaceId,
  }),
}));

vi.mock('../hooks/useStorageLocations', () => ({
  useStorageLocations: (workspaceId: string) => {
    if (workspaceId === 'ws-b') {
      return {
        data: [
          { id: 'loc-root', name: 'Garage', parentId: null, workspaceId: 'ws-b' },
          { id: 'loc-child', name: 'Shelf A', parentId: 'loc-root', workspaceId: 'ws-b' },
        ],
        isLoading: false,
      };
    }
    return { data: [], isLoading: false };
  },
}));

vi.mock('../../containers/hooks/useContainers', () => ({
  useContainers: () => ({
    data: [],
    isLoading: false,
  }),
}));

describe('LocationDetailScreen Breadcrumb', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.resetAllMocks();
  });

  const renderScreen = (workspaceId = 'ws-b', locationId = 'loc-child') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/workspaces/${workspaceId}/locations/${locationId}`]}>
          <Routes>
            <Route path="/workspaces/:workspaceId/locations/:locationId" element={<LocationDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders complete hierarchy including Storage Space B segment for root location', async () => {
    renderScreen('ws-b', 'loc-root');

    const spaceLink = await screen.findByRole('link', { name: /Storage Space B/i });
    expect(spaceLink).toBeInTheDocument();
    expect(spaceLink).toHaveAttribute('href', '/workspaces/ws-b');
    expect(screen.getByText('Garage')).toBeInTheDocument();
  });

  it('renders nested location hierarchy: Home / Storage Space B / Garage / Shelf A', async () => {
    renderScreen('ws-b', 'loc-child');

    const spaceLink = await screen.findByRole('link', { name: /Storage Space B/i });
    expect(spaceLink).toBeInTheDocument();
    expect(spaceLink).toHaveAttribute('href', '/workspaces/ws-b');

    const parentLink = screen.getByRole('link', { name: /Garage/i });
    expect(parentLink).toBeInTheDocument();
    expect(parentLink).toHaveAttribute('href', '/workspaces/ws-b/locations/loc-root');

    expect(screen.getByText('Shelf A')).toBeInTheDocument();
  });

  it('does NOT mutate Home active workspace state when viewing Location Detail in Workspace B', async () => {
    renderScreen('ws-b', 'loc-child');

    await screen.findByRole('link', { name: /Storage Space B/i });
    expect(mockSetActiveWorkspaceId).not.toHaveBeenCalled();
  });
});
