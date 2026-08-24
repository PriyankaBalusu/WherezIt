import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ContainerList } from './components/ContainerList';
import * as containerApi from './api/containerApi';
import * as locationApi from '../locations/api/locationApi';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test_user_uid_123', email: 'test@example.com' },
    getIdToken: vi.fn().mockResolvedValue('fake_id_token'),
  }),
}));

vi.mock('../locations/api/locationApi', () => ({
  fetchLocations: vi.fn(),
}));

vi.mock('./api/containerApi', () => ({
  fetchContainers: vi.fn(),
  createContainer: vi.fn(),
  updateContainer: vi.fn(),
  archiveContainer: vi.fn(),
  restoreContainer: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe('Container Management UI (BOX-003)', () => {
  it('renders loading state when containers are fetching', () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([]);
    vi.mocked(containerApi.fetchContainers).mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Loading containers/i)).toBeInTheDocument();
  });

  it('renders container cards with prominent BOX ID badges', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([
      { id: 'loc-1', workspaceId: 'ws-123', parentId: null, name: 'Garage', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
    ]);
    vi.mocked(containerApi.fetchContainers).mockResolvedValue([
      {
        id: 'c-1',
        workspaceId: 'ws-123',
        storageNodeId: 'loc-1',
        boxNumber: 1,
        boxId: 'BOX 001',
        name: 'Holiday Decor',
        description: 'Christmas stuff',
        isArchived: false,
        createdAt: '2026-08-17T00:00:00Z',
        updatedAt: '2026-08-17T00:00:00Z',
      },
    ]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 001')).toBeInTheDocument();
      expect(screen.getByText('Holiday Decor')).toBeInTheDocument();
      expect(screen.getByText('Christmas stuff')).toBeInTheDocument();
    });
  });

  it('triggers onAddBox callback when empty state Add Box button is clicked', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([
      { id: 'loc-1', workspaceId: 'ws-123', parentId: null, name: 'Garage', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
    ]);
    vi.mocked(containerApi.fetchContainers).mockResolvedValue([]);
    const mockAddBox = vi.fn();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" onAddBox={mockAddBox} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No boxes here yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Box/i }));
    expect(mockAddBox).toHaveBeenCalled();
  });
});


