import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceHome } from './WorkspaceHome';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaces: [{ id: 'ws-1', name: 'Home Workspace', role: 'OWNER' }],
    activeWorkspace: { id: 'ws-1', name: 'Home Workspace', role: 'OWNER' },
    setActiveWorkspaceId: vi.fn(),
    openCreateWorkspaceModal: vi.fn(),
  }),
}));

vi.mock('../../locations/hooks/useStorageLocations', () => ({
  useStorageLocations: () => ({ data: [], isLoading: false }),
  useCreateStorageLocation: () => ({ mutateAsync: vi.fn() }),
  useRenameStorageLocation: () => ({ mutateAsync: vi.fn() }),
  useDeleteStorageLocation: () => ({ mutateAsync: vi.fn() }),
  useMoveStorageLocation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../containers/hooks/useContainers', () => ({
  useContainers: () => ({
    data: [
      {
        id: 'c-1',
        workspaceId: 'ws-1',
        storageNodeId: 'loc-1',
        boxNumber: 7,
        boxId: 'BOX 007',
        name: 'Holiday Decorations',
        description: 'Tree lights & ornaments',
        isArchived: false,
        itemCount: 12,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    isLoading: false,
  }),
  useCreateContainer: () => ({ mutateAsync: vi.fn() }),
}));

describe('WorkspaceHome Redesign Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockNavigate.mockClear();
    queryClient = new QueryClient({
      defaultOptions: { retry: false } },
    });
  });

  const renderComponent = () => {
    const mockWorkspace = {
      id: 'ws-1',
      name: 'Home Workspace',
      inventoryNamespaceId: 'ns-1',
      role: 'OWNER',
      createdAt: '2026-01-01',
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkspaceHome activeWorkspace={mockWorkspace} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders search hero title, subtitle, and input placeholder', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /where is it\?/i })).toBeInTheDocument();
    expect(screen.getByText(/find anything you've stored\./i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/where are my christmas lights\?/i)).toBeInTheDocument();
  });

  it('renders suggestion chips and handles chip click navigation', () => {
    renderComponent();

    expect(screen.getByText(/try searching:/i)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /camping gear/i });
    fireEvent.click(chip);

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=camping%20gear');
  });

  it('renders Browse Storage card panel with light WorkspaceSelector and WorkspaceManageMenu button', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /browse storage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select active storage space/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage storage space options/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^locations$/i })).toBeInTheDocument();
  });

  it('renders dynamic section heading, consolidated Filter dropdown (Active, All, Archived), and no standalone checkbox', () => {
    renderComponent();

    // Dynamic section title
    expect(screen.getByRole('heading', { name: /all boxes · 1 box/i })).toBeInTheDocument();

    // Toolbar controls
    expect(screen.getByText(/sort:/i)).toBeInTheDocument();
    expect(screen.getByText(/filter:/i)).toBeInTheDocument();

    // Filter dropdown options
    const filterSelect = screen.getByRole('combobox', { name: /filter boxes/i });
    expect(filterSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /active boxes/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /all boxes \(active \+ archived\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /archived only/i })).toBeInTheDocument();

    // Standalone checkbox is no longer rendered
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // Redesigned box card tile contents
    expect(screen.getByText('BOX 007')).toBeInTheDocument();
    expect(screen.getByText('Holiday Decorations')).toBeInTheDocument();
    expect(screen.getByText('Tree lights & ornaments')).toBeInTheDocument();
    expect(screen.getByText(/📦 12 items/i)).toBeInTheDocument();

    // Entire box card clickability
    const cardTile = screen.getByText('Holiday Decorations').closest('[role="link"]');
    expect(cardTile).toBeInTheDocument();
    fireEvent.click(cardTile!);

    expect(mockNavigate).toHaveBeenCalledWith('/workspaces/ws-1/containers/c-1');
  });
});
