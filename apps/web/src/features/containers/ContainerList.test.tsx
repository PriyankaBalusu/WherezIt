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

  it('limits preview to 9 boxes, keeps full count in title, and expands/collapses list for 18 boxes', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([]);

    // Generate 18 test containers
    const mockBoxes = Array.from({ length: 18 }, (_, i) => ({
      id: `c-${i + 1}`,
      workspaceId: 'ws-123',
      storageNodeId: 'loc-1',
      boxNumber: i + 1,
      boxId: `BOX ${String(i + 1).padStart(3, '0')}`,
      name: `Box Item ${i + 1}`,
      isArchived: false,
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    }));
    vi.mocked(containerApi.fetchContainers).mockResolvedValue(mockBoxes);

    const { rerender } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Full count displays 18 in header
    await waitFor(() => {
      expect(screen.getByText(/All Boxes · 18 boxes/i)).toBeInTheDocument();
    });

    // 2. Initially only first 9 box cards are rendered
    expect(screen.getByText('BOX 001')).toBeInTheDocument();
    expect(screen.getByText('BOX 009')).toBeInTheDocument();
    expect(screen.queryByText('BOX 010')).toBeNull();

    // 3. View all boxes button is rendered
    const viewAllBtn = screen.getByRole('button', { name: /View all boxes/i });
    expect(viewAllBtn).toBeInTheDocument();

    // 4. Click View all boxes -> expands list to show all 18 boxes
    fireEvent.click(viewAllBtn);
    expect(screen.getByText('BOX 010')).toBeInTheDocument();
    expect(screen.getByText('BOX 018')).toBeInTheDocument();

    // 5. Show fewer button appears and clicking it collapses back to 9
    const showFewerBtn = screen.getByRole('button', { name: /Show fewer/i });
    fireEvent.click(showFewerBtn);
    expect(screen.queryByText('BOX 010')).toBeNull();

    // 6. Expand again then change location context -> resets back to 9 preview limit
    fireEvent.click(screen.getByRole('button', { name: /View all boxes/i }));
    expect(screen.getByText('BOX 010')).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" selectedLocationId="loc-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('BOX 010')).toBeNull();
    });
  });

  it('renders all boxes without View all button when matching boxes is 8 or 9', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([]);
    const mockBoxes = Array.from({ length: 9 }, (_, i) => ({
      id: `c-${i + 1}`,
      workspaceId: 'ws-123',
      storageNodeId: 'loc-1',
      boxNumber: i + 1,
      boxId: `BOX ${String(i + 1).padStart(3, '0')}`,
      name: `Box Item ${i + 1}`,
      isArchived: false,
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    }));
    vi.mocked(containerApi.fetchContainers).mockResolvedValue(mockBoxes);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 009')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /View all boxes/i })).toBeNull();
  });

  it('shows 9 initially and View all button when matching boxes is 10', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([]);
    const mockBoxes = Array.from({ length: 10 }, (_, i) => ({
      id: `c-${i + 1}`,
      workspaceId: 'ws-123',
      storageNodeId: 'loc-1',
      boxNumber: i + 1,
      boxId: `BOX ${String(i + 1).padStart(3, '0')}`,
      name: `Box Item ${i + 1}`,
      isArchived: false,
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    }));
    vi.mocked(containerApi.fetchContainers).mockResolvedValue(mockBoxes);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ContainerList workspaceId="ws-123" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 009')).toBeInTheDocument();
    });

    expect(screen.queryByText('BOX 010')).toBeNull();
    expect(screen.getByRole('button', { name: /View all boxes/i })).toBeInTheDocument();
  });
});


