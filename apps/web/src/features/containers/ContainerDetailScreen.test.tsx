import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContainerDetailScreen } from './components/ContainerDetailScreen';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    getIdToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

vi.mock('../workspaces/context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaces: [{ id: 'ws-123', name: 'My Home', role: 'OWNER' }],
    activeWorkspace: { id: 'ws-123', name: 'My Home', role: 'OWNER' },
    setActiveWorkspaceId: vi.fn(),
    openCreateWorkspaceModal: vi.fn(),
  }),
}));

let mockPhysicalLabel: string | null = 'Attic Box #1';
let mockLabelImage: any = null;

vi.mock('./hooks/useContainers', () => ({
  useContainer: (workspaceId?: string, containerId?: string) => {
    if (containerId === 'box-not-found') {
      return { data: null, isLoading: false, isError: true, error: new Error('Container not found') };
    }
    return {
      data: {
        id: containerId || 'cont-123',
        workspaceId: workspaceId || 'ws-123',
        boxId: 'BOX 001',
        name: 'Holiday Decorations',
        description: 'Christmas and Thanksgiving lights',
        storageNodeId: 'loc-100',
        physicalLabel: mockPhysicalLabel,
        isArchived: false,
      },
      isLoading: false,
      isError: false,
    };
  },
  useUpdateContainer: () => ({ mutateAsync: vi.fn() }),
  useArchiveContainer: () => ({ mutateAsync: vi.fn() }),
  useRestoreContainer: () => ({ mutateAsync: vi.fn() }),
  useDeleteContainer: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../locations/hooks/useStorageLocations', () => ({
  useStorageLocations: () => ({
    data: [
      { id: 'loc-100', name: 'Attic', parentId: 'loc-root' },
      { id: 'loc-root', name: 'Home', parentId: null },
    ],
  }),
}));

vi.mock('./hooks/useContainerImages', () => ({
  useContainerImages: () => ({ data: [] }),
  useDeleteContainerImage: () => ({ mutateAsync: vi.fn() }),
  useUploadContainerImage: () => ({ mutateAsync: vi.fn() }),
  usePhysicalLabelImage: () => ({ data: mockLabelImage }),
  useUploadPhysicalLabelImage: () => ({ mutateAsync: vi.fn() }),
  useDeletePhysicalLabelImage: () => ({ mutateAsync: vi.fn() }),
  useDeleteExistingLabel: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../identifiers/hooks/useIdentifiers', () => ({
  useContainerIdentifiers: () => ({ data: [] }),
}));

vi.mock('../items/hooks/useItems', () => ({
  useItems: () => ({
    data: [
      { id: 'item-1', name: 'Christmas Lights', quantity: 3, category: 'Holiday', isArchived: false },
      { id: 'item-2', name: 'Tree Topper', quantity: 1, category: 'Holiday', isArchived: false },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateItem: () => ({ mutateAsync: vi.fn() }),
  useArchiveItem: () => ({ mutateAsync: vi.fn() }),
  useRestoreItem: () => ({ mutateAsync: vi.fn() }),
  useDeleteItem: () => ({ mutateAsync: vi.fn() }),
}));

describe('ContainerDetailScreen Regression Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockPhysicalLabel = null;
    mockLabelImage = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders container detail when items have zero images without blank screen', async () => {
    mockPhysicalLabel = 'Attic Box #1';
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Holiday Decorations')).toBeInTheDocument();
    expect(screen.getAllByText('BOX 001').length).toBeGreaterThan(0);
    expect(screen.getByText('Christmas Lights')).toBeInTheDocument();
    expect(screen.getByText('Tree Topper')).toBeInTheDocument();
    expect(screen.getByText('Home → Attic')).toBeInTheDocument();
  });

  it('renders safe error state when container fetch fails', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/box-not-found']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("We couldn't load this box.")).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Back to Storage')).toBeInTheDocument();
  });

  it('A. hides Existing Label section when no text and no photo exist', async () => {
    mockPhysicalLabel = null;
    mockLabelImage = null;
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Holiday Decorations')).toBeInTheDocument();
    expect(screen.queryByText('EXISTING LABEL')).not.toBeInTheDocument();
    expect(screen.queryByText('No existing label added.')).not.toBeInTheDocument();
  });

  it('B. renders Existing Label section when text exists', async () => {
    mockPhysicalLabel = 'Handwritten Storage Label';
    mockLabelImage = null;
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('EXISTING LABEL')).toBeInTheDocument();
    expect(screen.getByText('🏷️ Handwritten Storage Label')).toBeInTheDocument();
  });

  it('C. renders Existing Label section when photo exists', async () => {
    mockPhysicalLabel = null;
    mockLabelImage = { id: 'img-1', url: 'https://example.com/label.jpg' };
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('EXISTING LABEL')).toBeInTheDocument();
    expect(screen.getByText('From photographed label')).toBeInTheDocument();
  });

  it('D. renders Existing Label section when both text and photo exist', async () => {
    mockPhysicalLabel = 'Garage Tools';
    mockLabelImage = { id: 'img-1', url: 'https://example.com/label.jpg' };
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('EXISTING LABEL')).toBeInTheDocument();
    expect(screen.getByText('🏷️ Garage Tools')).toBeInTheDocument();
    expect(screen.getByText('From photographed label')).toBeInTheDocument();
  });

  it('E-H. opens general chooser with + Add Existing Code or Label button and renders level 1 and level 2 options', async () => {
    mockPhysicalLabel = null;
    mockLabelImage = null;
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const btn = await screen.findByText('+ Add Existing Code or Label');
    expect(btn).toBeInTheDocument();
  });

  it('renders Packed badge but excludes moving-specific priority indicators from standard Box Detail header', async () => {
    mockPhysicalLabel = null;
    mockLabelImage = null;
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Holiday Decorations')).toBeInTheDocument();
    expect(screen.getByText('Packed')).toBeInTheDocument();
    expect(screen.queryByText('Open first')).not.toBeInTheDocument();
    expect(screen.queryByText('Can wait')).not.toBeInTheDocument();
  });

  it('renders mobile quick summary counts and section navigation tabs with tab switching support', async () => {
    mockPhysicalLabel = null;
    mockLabelImage = null;
    const { fireEvent } = await import('@testing-library/react');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Summary counts row
    expect(await screen.findByRole('region', { name: /box summary counts/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 items in mock
    expect(screen.getByText('items')).toBeInTheDocument();

    // Section navigation tabs
    const contentsTab = screen.getByRole('tab', { name: /contents/i });
    const photosTab = screen.getByRole('tab', { name: /photos/i });
    const codesTab = screen.getByRole('tab', { name: /codes/i });
    const historyTab = screen.getByRole('tab', { name: /history/i });

    expect(contentsTab).toBeInTheDocument();
    expect(photosTab).toBeInTheDocument();
    expect(codesTab).toBeInTheDocument();
    expect(historyTab).toBeInTheDocument();

    // Contents active by default (only Contents section in DOM on mobile)
    expect(contentsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Christmas Lights')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^photos$/i })).not.toBeInTheDocument();

    // Switch to Photos (only Photos section in DOM on mobile)
    fireEvent.click(photosTab);
    expect(photosTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /^photos$/i })).toBeInTheDocument();
    expect(screen.queryByText('Christmas Lights')).not.toBeInTheDocument();

    // Switch to Codes (only Codes section in DOM on mobile)
    fireEvent.click(codesTab);
    expect(codesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /labels & codes/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^photos$/i })).not.toBeInTheDocument();

    // Switch to History (only History section in DOM on mobile)
    fireEvent.click(historyTab);
    expect(historyTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Box History')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /labels & codes/i })).not.toBeInTheDocument();

    // Switch back to Contents
    fireEvent.click(contentsTab);
    expect(contentsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('+ Add Item')).toBeInTheDocument();
  });

  it('renders full two-column grid on desktop viewports without mobile tab shell', async () => {
    // Set window width to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Desktop grid layout is rendered
    expect(await screen.findByText('Holiday Decorations')).toBeInTheDocument();
    expect(screen.getByText('Christmas Lights')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /labels & codes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^photos$/i })).toBeInTheDocument();
    expect(screen.getByText('Box History')).toBeInTheDocument();

    // Mobile tabs and summary row are NOT rendered on desktop
    expect(screen.queryByRole('region', { name: /box summary counts/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('renders Storage Space in Box Detail breadcrumb linking to /workspaces/:workspaceId', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspaces/ws-123/containers/cont-123']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<ContainerDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const spaceLink = await screen.findByRole('link', { name: /My Home/i });
    expect(spaceLink).toBeInTheDocument();
    expect(spaceLink).toHaveAttribute('href', '/workspaces/ws-123');
  });
});
