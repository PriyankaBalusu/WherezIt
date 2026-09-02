import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceManageMenu } from './WorkspaceManageMenu';
import { Workspace } from '../types/workspace';

vi.mock('../hooks/useWorkspaces', () => ({
  useRenameWorkspace: () => ({ mutateAsync: vi.fn() }),
  useDeleteWorkspace: () => ({ mutateAsync: vi.fn() }),
  useLeaveWorkspace: () => ({ mutateAsync: vi.fn() }),
  useWorkspaceAudits: () => ({
    data: [
      {
        id: 'audit-1',
        workspaceId: 'ws-1',
        workspaceName: 'Main Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'WORKSPACE_CREATED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-01T10:00:00Z',
        detailsJson: null,
      },
      {
        id: 'audit-2',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'WORKSPACE_RENAMED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-01T11:00:00Z',
        detailsJson: '{"previousWorkspaceName":"Uhaul","newWorkspaceName":"Uhaul Storage"}',
      },
      {
        id: 'audit-3',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'LOCATION_CREATED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-02T10:00:00Z',
        detailsJson: '{"locationId":"loc-1","locationName":"Garage","parentLocationId":null,"parentLocationName":null}',
      },
      {
        id: 'audit-4',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'LOCATION_CREATED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-03T10:00:00Z',
        detailsJson: '{"locationId":"loc-2","locationName":"Shelf A","parentLocationId":"loc-1","parentLocationName":"Garage"}',
      },
      {
        id: 'audit-5',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'LOCATION_RENAMED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-04T10:00:00Z',
        detailsJson: '{"locationId":"loc-1","previousLocationName":"Garage","newLocationName":"Main Garage","parentLocationId":null,"parentLocationName":null}',
      },
      {
        id: 'audit-6',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'LOCATION_RENAMED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-05T10:00:00Z',
        detailsJson: '{"locationId":"loc-2","previousLocationName":"Shelf A","newLocationName":"Shelf A1","parentLocationId":"loc-1","parentLocationName":"Main Garage"}',
      },
      {
        id: 'audit-7',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'LOCATION_DELETED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-06T10:00:00Z',
        detailsJson: '{"locationId":"loc-2","locationName":"Shelf A1","parentLocationId":"loc-1","parentLocationName":"Main Garage"}',
      },
      {
        id: 'audit-8',
        workspaceId: 'ws-1',
        workspaceName: 'Uhaul Storage',
        inventoryNamespaceId: 'ns-1',
        eventType: 'WORKSPACE_DELETED',
        actorUserId: 'user-1',
        occurredAt: '2026-08-07T10:00:00Z',
        detailsJson: '{"locationsCount":2,"boxesCount":5,"itemsCount":10}',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
    getIdToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));

describe('WorkspaceManageMenu & Activity Modal Full Event Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('10. WorkspaceActivityModal renders all six supported event types', () => {
    const workspace: Workspace = {
      id: 'ws-1',
      name: 'Uhaul Storage',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00Z',
      inventoryNamespaceId: 'ns-1',
      memberCount: 2,
      ownerCount: 2,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceManageMenu workspace={workspace} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Manage storage space options/i }));
    fireEvent.click(screen.getByRole('button', { name: /Storage Space Activity/i }));

    expect(screen.getByText(/Storage Space Activity/i)).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText(/Storage Space renamed: Uhaul → Uhaul Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/Location added: Garage/i)).toBeInTheDocument();
    expect(screen.getByText(/Sub-location added: Shelf A/i)).toBeInTheDocument();
    expect(screen.getByText(/Location renamed: Garage → Main Garage/i)).toBeInTheDocument();
    expect(screen.getByText(/Sub-location renamed: Shelf A → Shelf A1/i)).toBeInTheDocument();
    expect(screen.getByText(/Sub-location deleted: Shelf A1/i)).toBeInTheDocument();
    expect(screen.getByText(/Storage Space deleted: Uhaul Storage/i)).toBeInTheDocument();
  });
});
