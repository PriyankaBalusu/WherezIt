import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BoxHistoryTimeline } from './BoxHistoryTimeline';
import * as useBoxHistoryModule from '../hooks/useBoxHistory';

describe('BoxHistoryTimeline Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.resetAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BoxHistoryTimeline workspaceId="ws-123" containerId="c-456" />
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    vi.spyOn(useBoxHistoryModule, 'useBoxHistory').mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText(/loading activity history\.\.\./i)).toBeInTheDocument();
  });

  it('renders friendly empty state when no history exists', () => {
    vi.spyOn(useBoxHistoryModule, 'useBoxHistory').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText(/no history yet/i)).toBeInTheDocument();
    expect(screen.getByText(/activity for this box will appear here as changes are made\./i)).toBeInTheDocument();
  });

  it('renders read-only timeline entries with distinct item archived, restored, and removed events', () => {
    const mockHistory: useBoxHistoryModule.BoxHistoryItem[] = [
      {
        id: 'h-1',
        activityType: 'ITEM_REMOVED',
        title: 'Item removed',
        description: 'Old Blanket · Qty 1',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-30T17:00:00Z',
      },
      {
        id: 'h-2',
        activityType: 'ITEM_RESTORED',
        title: 'Item restored',
        description: 'Winter Jacket · Qty 1',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-30T16:30:00Z',
      },
      {
        id: 'h-3',
        activityType: 'ITEM_ARCHIVED',
        title: 'Item archived',
        description: 'Winter Jacket · Qty 1',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-30T16:00:00Z',
      },
      {
        id: 'h-4',
        activityType: 'ITEM_ADDED',
        title: 'Item added',
        description: 'Nike Sneakers · Qty 2',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-30T15:00:00Z',
      },
    ];

    vi.spyOn(useBoxHistoryModule, 'useBoxHistory').mockReturnValue({
      data: mockHistory,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Box History')).toBeInTheDocument();
    expect(screen.getByText('4 events')).toBeInTheDocument();

    // Timeline item titles and descriptions
    expect(screen.getByText('Item removed')).toBeInTheDocument();
    expect(screen.getByText('Old Blanket · Qty 1')).toBeInTheDocument();

    expect(screen.getByText('Item restored')).toBeInTheDocument();
    expect(screen.getAllByText('Winter Jacket · Qty 1').length).toBe(2);

    expect(screen.getByText('Item archived')).toBeInTheDocument();

    expect(screen.getByText('Item added')).toBeInTheDocument();
    expect(screen.getByText('Nike Sneakers · Qty 2')).toBeInTheDocument();

    // Read-only check: no edit/delete buttons present
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('renders photo added and photo removed events alongside container creation and movement events', () => {
    const mockHistory: useBoxHistoryModule.BoxHistoryItem[] = [
      {
        id: 'h-photo-2',
        activityType: 'PHOTO_REMOVED',
        title: 'Photo removed',
        description: 'Photo removed',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-31T12:00:00Z',
      },
      {
        id: 'h-photo-1',
        activityType: 'PHOTO_ADDED',
        title: 'Photo added',
        description: 'Photo uploaded',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-31T11:00:00Z',
      },
      {
        id: 'h-box-created',
        activityType: 'CONTAINER_CREATED',
        title: 'Box created',
        description: 'Created in Garage',
        containerId: 'c-456',
        workspaceId: 'ws-123',
        actorUserId: 'user-1',
        occurredAt: '2026-08-30T10:00:00Z',
      },
    ];

    vi.spyOn(useBoxHistoryModule, 'useBoxHistory').mockReturnValue({
      data: mockHistory,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Box History')).toBeInTheDocument();
    expect(screen.getByText('3 events')).toBeInTheDocument();
    expect(screen.getByText('Photo removed')).toBeInTheDocument();
    expect(screen.getByText('Photo added')).toBeInTheDocument();
    expect(screen.getByText('Box created')).toBeInTheDocument();
  });
});
