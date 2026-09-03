import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceHome } from './WorkspaceHome';
import { Workspace } from '../types/workspace';

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
  useStorageLocations: () => ({
    data: [
      { id: 'loc-1', workspaceId: 'ws-1', name: 'Garage', parentId: null },
      { id: 'loc-2', workspaceId: 'ws-1', name: 'Rack A', parentId: 'loc-1' },
    ],
    isLoading: false,
  }),
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
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = () => {
    const mockWorkspace: Workspace = {
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

  it('renders search hero title, subtitle, and input placeholder on desktop viewports', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    renderComponent();

    expect(screen.getByRole('heading', { name: /where is it\?/i })).toBeInTheDocument();
    expect(screen.getByText(/find anything you've stored\./i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/where are my christmas lights\?/i)).toBeInTheDocument();
  });

  it('renders suggestion chips and handles chip click navigation on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    renderComponent();

    expect(screen.getByText(/try searching:/i)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /camping gear/i });
    fireEvent.click(chip);

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=camping%20gear');
  });

  it('renders Browse Storage card panel with light WorkspaceSelector and WorkspaceManageMenu button on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    renderComponent();

    expect(screen.getByRole('heading', { name: /browse storage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select active storage space/i })).toBeInTheDocument();
    
    const manageBtn = screen.getByRole('button', { name: /manage storage space options/i });
    expect(manageBtn).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^locations$/i })).toBeInTheDocument();

    // Click overflow menu button
    fireEvent.click(manageBtn);
    expect(screen.getByRole('button', { name: /rename storage space/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete storage space/i })).toBeInTheDocument();
  });

  it('renders dynamic section heading, consolidated Filter dropdown, and box card tile on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
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

    // Box card tile contents
    expect(screen.getByText('BOX 007')).toBeInTheDocument();
    expect(screen.getByText('Holiday Decorations')).toBeInTheDocument();
    expect(screen.getByText(/📦 12 items/i)).toBeInTheDocument();

    // Entire box card clickability
    const cardTile = screen.getByText('Holiday Decorations').closest('[role="link"]');
    expect(cardTile).toBeInTheDocument();
    fireEvent.click(cardTile!);

    expect(mockNavigate).toHaveBeenCalledWith('/workspaces/ws-1/containers/c-1');
  });

  it('renders compact mobile home layout with navy header, search+scan, storage space selector, location preview, and location drill-down on mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    renderComponent();

    // 1. Single Outer Page Container and Inner Mobile Layout Structure
    const pageContainerEl = document.querySelector('.mobile-page-container');
    const homeLayoutEl = document.querySelector('.mobile-home-layout');
    expect(pageContainerEl).toBeInTheDocument();
    expect(pageContainerEl).toHaveAttribute('data-layout', 'mobile');
    expect(homeLayoutEl).toBeInTheDocument();
    expect(pageContainerEl).toContainElement(homeLayoutEl as HTMLElement);

    const brandTitles = screen.getAllByText('WherezIt');
    expect(brandTitles).toHaveLength(1);
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(document.querySelector('.nav-brand')).toBeInTheDocument();
    expect(document.querySelector('.nav-right')).toBeInTheDocument();

    // 2. Compact Search input and Search button
    expect(screen.getByPlaceholderText(/what are you looking for\?/i)).toBeInTheDocument();
    const searchBtn = screen.getByRole('button', { name: /^search$/i });
    expect(searchBtn).toBeInTheDocument();

    // 3. Mobile suggestion label `Try:` and wrapping chip list structure
    const suggestionsEl = document.querySelector('.mobile-search-suggestions');
    const chipListEl = document.querySelector('.mobile-chip-list');
    expect(suggestionsEl).toBeInTheDocument();
    expect(chipListEl).toBeInTheDocument();
    expect(suggestionsEl).toContainElement(screen.getByText(/^try:$/i));
    expect(suggestionsEl).toContainElement(chipListEl as HTMLElement);
    expect(chipListEl?.children.length).toBe(3);

    // 4. Global mobile header three-dot menu is absent
    expect(screen.queryByRole('button', { name: /navigation menu/i })).not.toBeInTheDocument();

    // 5. Storage space selector card and contextual manage menu
    expect(screen.getByText(/storage space/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage storage space options/i })).toBeInTheDocument();

    // 6. All Boxes section panel structure
    const boxesCardEl = document.querySelector('.mobile-card.mobile-boxes-card');
    expect(boxesCardEl).toBeInTheDocument();
    expect(screen.getByText(/all boxes ·/i)).toBeInTheDocument();
    expect(boxesCardEl).toContainElement(screen.getByRole('button', { name: /\+ add box/i }));

    // 7. Compact location preview card header
    const locationsCardEl = document.querySelector('.mobile-card.mobile-locations-card');
    expect(locationsCardEl).toBeInTheDocument();
    expect(screen.getByText(/browse locations/i)).toBeInTheDocument();
    const viewAllBtn = screen.getByRole('button', { name: /view all →/i });
    expect(viewAllBtn).toBeInTheDocument();
    expect(locationsCardEl?.querySelector('.mobile-card-header')).toContainElement(viewAllBtn);

    // Location row `Garage`
    const garageRow = screen.getByRole('button', { name: /garage/i });
    expect(garageRow).toBeInTheDocument();
    expect(screen.getByText(/1 box · 1 sublocation/i)).toBeInTheDocument();

    // 5. Tap Garage to drill down into Garage Location View
    fireEvent.click(garageRow);

    // Verify Location Drill-down View
    expect(screen.getByRole('button', { name: /‹ back/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^garage$/i })).toBeInTheDocument();
    expect(screen.getByText(/home workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ add sublocation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rack a/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /boxes in garage · 1 box/i })).toBeInTheDocument();
    expect(screen.getByText('BOX 007')).toBeInTheDocument();
    expect(screen.getByText('Holiday Decorations')).toBeInTheDocument();

    // 8. Verify mobile + Add Box button opens modal and defaults to current location (Garage)
    const addBoxBtn = screen.getAllByRole('button', { name: /\+ add box/i })[0];
    fireEvent.click(addBoxBtn);
    expect(screen.getByRole('heading', { name: /^add box$/i })).toBeInTheDocument();

    const locationSelect = screen.getByLabelText(/storage location/i) as HTMLSelectElement;
    expect(locationSelect.value).toBe('loc-1');
  });
});
