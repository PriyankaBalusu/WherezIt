import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StorageLocationList } from './components/StorageLocationList';
import * as locationApi from './api/locationApi';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test_user_uid_123', email: 'test@example.com' },
    getIdToken: vi.fn().mockResolvedValue('fake_id_token'),
  }),
}));

vi.mock('./api/locationApi', () => ({
  fetchLocations: vi.fn(),
  createLocation: vi.fn(),
  renameLocation: vi.fn(),
  deleteLocation: vi.fn(),
  moveLocation: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe('Storage Location UI (LOC-002 & LOC-003)', () => {
  it('renders loading state when locations are being fetched', () => {
    vi.mocked(locationApi.fetchLocations).mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StorageLocationList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Loading storage locations/i)).toBeInTheDocument();
  });

  it('renders storage hierarchy tree when locations are loaded', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([
      { id: 'loc-1', workspaceId: 'ws-123', parentId: null, name: 'Garage', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
      { id: 'loc-2', workspaceId: 'ws-123', parentId: 'loc-1', name: 'Rack A', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
    ]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StorageLocationList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Garage')).toBeInTheDocument();
      expect(screen.getByText('Rack A')).toBeInTheDocument();
    });
  });

  it('calls createLocation API when submitting create location form', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([]);
    vi.mocked(locationApi.createLocation).mockResolvedValue({
      id: 'new-loc',
      workspaceId: 'ws-123',
      parentId: null,
      name: 'Basement',
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StorageLocationList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Add root location/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Add root location/i), { target: { value: 'Basement' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Location/i }));

    await waitFor(() => {
      expect(locationApi.createLocation).toHaveBeenCalledWith(
        'ws-123',
        { name: 'Basement', parentId: null },
        expect.any(Function)
      );
    });
  });

  it('calls deleteLocation API when clicking Delete button', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([
      { id: 'loc-empty', workspaceId: 'ws-123', parentId: null, name: 'Empty Node', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
    ]);
    vi.mocked(locationApi.deleteLocation).mockResolvedValue();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StorageLocationList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Empty Node')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(locationApi.deleteLocation).toHaveBeenCalledWith('ws-123', 'loc-empty', expect.any(Function));
    });
  });

  it('calls moveLocation API when clicking Move to Root button', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([
      { id: 'loc-root', workspaceId: 'ws-123', parentId: null, name: 'Root', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
      { id: 'loc-child', workspaceId: 'ws-123', parentId: 'loc-root', name: 'Child', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
    ]);
    vi.mocked(locationApi.moveLocation).mockResolvedValue({
      id: 'loc-child',
      workspaceId: 'ws-123',
      parentId: null,
      name: 'Child',
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StorageLocationList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Child')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Move to Root/i }));

    await waitFor(() => {
      expect(locationApi.moveLocation).toHaveBeenCalledWith(
        'ws-123',
        'loc-child',
        { parentId: null },
        expect.any(Function)
      );
    });
  });
});
