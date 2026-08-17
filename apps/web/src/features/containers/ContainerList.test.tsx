import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
        <ContainerList workspaceId="ws-123" />
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
        <ContainerList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 001')).toBeInTheDocument();
      expect(screen.getByText('Holiday Decor')).toBeInTheDocument();
      expect(screen.getByText('Christmas stuff')).toBeInTheDocument();
    });
  });

  it('calls createContainer API when submitting form', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([
      { id: 'loc-1', workspaceId: 'ws-123', parentId: null, name: 'Garage', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z' },
    ]);
    vi.mocked(containerApi.fetchContainers).mockResolvedValue([]);
    vi.mocked(containerApi.createContainer).mockResolvedValue({
      id: 'c-new',
      workspaceId: 'ws-123',
      storageNodeId: 'loc-1',
      boxNumber: 1,
      boxId: 'BOX 001',
      name: 'Tools Bin',
      description: undefined,
      isArchived: false,
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ContainerList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'loc-1' } });
    fireEvent.change(screen.getByPlaceholderText(/Container Name/i), { target: { value: 'Tools Bin' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Container/i }));

    await waitFor(() => {
      expect(containerApi.createContainer).toHaveBeenCalledWith(
        'ws-123',
        { storageNodeId: 'loc-1', name: 'Tools Bin', description: undefined },
        expect.any(Function)
      );
    });
  });

  it('calls archiveContainer API when clicking Archive', async () => {
    vi.mocked(locationApi.fetchLocations).mockResolvedValue([]);
    vi.mocked(containerApi.fetchContainers).mockResolvedValue([
      {
        id: 'c-archive',
        workspaceId: 'ws-123',
        storageNodeId: 'loc-1',
        boxNumber: 1,
        boxId: 'BOX 001',
        name: 'Old Items',
        description: null,
        isArchived: false,
        createdAt: '2026-08-17T00:00:00Z',
        updatedAt: '2026-08-17T00:00:00Z',
      },
    ]);
    vi.mocked(containerApi.archiveContainer).mockResolvedValue({
      id: 'c-archive',
      workspaceId: 'ws-123',
      storageNodeId: 'loc-1',
      boxNumber: 1,
      boxId: 'BOX 001',
      name: 'Old Items',
      description: null,
      isArchived: true,
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ContainerList workspaceId="ws-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BOX 001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Archive/i }));

    await waitFor(() => {
      expect(containerApi.archiveContainer).toHaveBeenCalledWith('ws-123', 'c-archive', expect.any(Function));
    });
  });
});
