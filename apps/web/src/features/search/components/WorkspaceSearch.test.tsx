import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSearch } from './WorkspaceSearch';
import * as useSearchModule from '../hooks/useSearch';

vi.mock('../../workspaces/context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    activeWorkspace: { id: 'ws-1', name: 'Home Workspace' },
    setActiveWorkspaceId: vi.fn(),
  }),
}));

describe('WorkspaceSearch Usability Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.resetAllMocks();
  });

  const mockSearchResults: useSearchModule.SearchResult[] = [
    ...Array.from({ length: 15 }, (_, i) => ({
      resultType: 'ITEM' as const,
      workspaceId: 'ws-1',
      workspaceName: 'Home Workspace',
      itemId: `item-${i + 1}`,
      itemName: `Item ${i + 1}`,
      quantity: 1,
      containerId: 'c-1',
      boxNumber: 1,
      boxDisplayId: 'BOX 001',
      breadcrumb: ['Garage'],
      breadcrumbDisplay: 'Garage',
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      resultType: 'CONTAINER' as const,
      workspaceId: 'ws-1',
      workspaceName: 'Home Workspace',
      containerId: `box-${i + 1}`,
      boxNumber: i + 2,
      boxDisplayId: `BOX 00${i + 2}`,
      breadcrumb: ['Storage Shed'],
      breadcrumbDisplay: 'Storage Shed',
    })),
  ];

  const renderComponent = (initialQuery = 'Christmas') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/search?q=${initialQuery}`]}>
          <WorkspaceSearch initialQuery={initialQuery} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders total result count and default pagination for search results', () => {
    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: mockSearchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Christmas');

    // Total result count after All Results filter
    expect(screen.getByText('20 results')).toBeInTheDocument();

    // Default page size = 10, showing 1-10
    expect(screen.getByText('Showing 1–10 of 20')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    // Previous disabled on page 1, Next enabled
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('handles page navigation (Next / Previous)', () => {
    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: mockSearchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Christmas');

    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Showing 11–20 of 20')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();
  });

  it('filters results by resultType and updates result count & pagination', () => {
    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: mockSearchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Christmas');

    const filterSelect = screen.getByRole('combobox', { name: /filter results by type/i });
    fireEvent.change(filterSelect, { target: { value: 'CONTAINER' } });

    // 5 CONTAINER results
    expect(screen.getByText('5 results')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–5 of 5')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('changes page size and resets page to 1', () => {
    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: mockSearchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Christmas');

    const pageSizeSelect = screen.getByRole('combobox', { name: /results per page/i });
    fireEvent.change(pageSizeSelect, { target: { value: '20' } });

    expect(screen.getByText('Showing 1–20 of 20')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('shows friendly empty state when a filter has no matching results', () => {
    const itemOnlyResults = mockSearchResults.filter((r) => r.resultType === 'ITEM');
    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: itemOnlyResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Christmas');

    const filterSelect = screen.getByRole('combobox', { name: /filter results by type/i });
    fireEvent.change(filterSelect, { target: { value: 'CONTAINER' } });

    expect(screen.getByText(/no box results found for "christmas"/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view all results \(15\)/i })).toBeInTheDocument();
  });

  it('formats trailing "Workspace" from Storage Space name in badge and breadcrumb display', () => {
    const formattedSearchResults: useSearchModule.SearchResult[] = [
      {
        resultType: 'ITEM',
        workspaceId: 'ws-demo',
        workspaceName: 'Demo Home Workspace',
        itemId: 'item-demo',
        itemName: 'Camping Tent',
        quantity: 1,
        containerId: 'c-demo',
        boxNumber: 10,
        boxDisplayId: 'BOX 010',
        breadcrumb: ['Garage', 'Rack A'],
        breadcrumbDisplay: 'Demo Home Workspace → Garage → Rack A',
      },
    ];

    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: formattedSearchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Camping');

    // Badge should render "🏠 Demo Home" (trailing Workspace removed)
    expect(screen.getByText('🏠 Demo Home')).toBeInTheDocument();

    // Breadcrumb should render formatted Storage Space prefix "Demo Home → Garage → Rack A"
    expect(screen.getByText('Demo Home → Garage → Rack A')).toBeInTheDocument();
  });

  it('applies responsive classes to hide storage space badge on mobile while preserving type badge and breadcrumb', () => {
    const formattedSearchResults: useSearchModule.SearchResult[] = [
      {
        resultType: 'CONTAINER',
        workspaceId: 'ws-demo',
        workspaceName: 'Demo Home Workspace',
        containerId: 'c-007',
        boxNumber: 7,
        boxDisplayId: 'BOX 007',
        breadcrumb: ['Garage', 'Rack A', 'Shelf 1'],
        breadcrumbDisplay: 'Demo Home Workspace → Garage → Rack A → Shelf 1',
      },
    ];

    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: formattedSearchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('BOX 007');

    const workspaceBadge = screen.getByText('🏠 Demo Home');
    expect(workspaceBadge).toHaveClass('search-result-workspace-badge');

    // Type badge still renders
    expect(screen.getByText('CONTAINER')).toBeInTheDocument();

    // Full breadcrumb still renders
    expect(screen.getByText('Demo Home → Garage → Rack A → Shelf 1')).toBeInTheDocument();
  });

  it('renders mobile compact card with full-card link navigation and concise metadata without redundant labels', () => {
    const searchResults: useSearchModule.SearchResult[] = [
      {
        resultType: 'CONTAINER',
        workspaceId: 'ws-demo',
        workspaceName: 'Demo Home Workspace',
        containerId: 'c-007',
        boxNumber: 7,
        boxDisplayId: 'BOX 007',
        itemName: 'Holiday Decorations',
        breadcrumb: ['Garage', 'Rack A', 'Shelf 1'],
        breadcrumbDisplay: 'Demo Home Workspace → Garage → Rack A → Shelf 1',
      },
      {
        resultType: 'ITEM',
        workspaceId: 'ws-demo',
        workspaceName: 'Demo Home Workspace',
        itemId: 'item-lights',
        itemName: 'Christmas Lights',
        quantity: 2,
        containerId: 'c-007',
        boxNumber: 7,
        boxDisplayId: 'BOX 007',
        breadcrumb: ['Garage', 'Rack A', 'Shelf 1'],
        breadcrumbDisplay: 'Demo Home Workspace → Garage → Rack A → Shelf 1',
      },
    ];

    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: searchResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Search Query');

    // Desktop card renders standalone Open Box button
    const openBoxLinks = screen.getAllByRole('link', { name: /Open Box →/i });
    expect(openBoxLinks.length).toBe(2);

    // Mobile card renders full-card links pointing to box detail route
    const allLinks = screen.getAllByRole('link');
    const mobileLinks = allLinks.filter((l) => l.classList.contains('search-result-card-mobile'));
    expect(mobileLinks.length).toBe(2);
    expect(mobileLinks[0]).toHaveAttribute('href', '/workspaces/ws-demo/containers/c-007');

    // Mobile Item metadata contains "Qty 2 · BOX 007"
    expect(screen.getByText('Qty 2 · BOX 007')).toBeInTheDocument();
  });

  it('renders container result title as container name only while preserving BOX number metadata and CONTAINER badge', () => {
    const containerResults: useSearchModule.SearchResult[] = [
      {
        resultType: 'CONTAINER',
        workspaceId: 'ws-demo',
        workspaceName: 'Demo Home Workspace',
        containerId: 'c-007',
        boxNumber: 7,
        boxDisplayId: 'BOX 007',
        containerName: 'Holiday Decorations',
        breadcrumb: ['Garage', 'Rack A', 'Shelf 1'],
        breadcrumbDisplay: 'Demo Home Workspace → Garage → Rack A → Shelf 1',
      },
      {
        resultType: 'ITEM',
        workspaceId: 'ws-demo',
        workspaceName: 'Demo Home Workspace',
        itemId: 'item-lights',
        itemName: 'Christmas Lights',
        quantity: 2,
        containerId: 'c-007',
        boxNumber: 7,
        boxDisplayId: 'BOX 007',
        breadcrumb: ['Garage', 'Rack A', 'Shelf 1'],
        breadcrumbDisplay: 'Demo Home Workspace → Garage → Rack A → Shelf 1',
      },
    ];

    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: containerResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Holiday');

    // Main container title renders ONLY container name "Holiday Decorations" (without Container BOX 007 — prefix)
    expect(screen.getAllByText('Holiday Decorations').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Container BOX 007 —/i)).not.toBeInTheDocument();

    // Item result title remains unchanged "Christmas Lights"
    expect(screen.getAllByText('Christmas Lights').length).toBeGreaterThan(0);

    // BOX 007 metadata pill still renders
    expect(screen.getAllByText('BOX 007').length).toBeGreaterThan(0);

    // CONTAINER badge still renders
    expect(screen.getAllByText('CONTAINER').length).toBeGreaterThan(0);
  });

  it('7: opens box detail for result from another storage space directly without mutating Home active workspace', async () => {
    const mockSearchData: useSearchModule.SearchResult[] = [
      {
        resultType: 'CONTAINER',
        workspaceId: 'ws-other',
        workspaceName: 'Other Workspace',
        containerId: 'box-99',
        boxNumber: 99,
        boxDisplayId: 'BOX 099',
        containerName: 'Other Box',
        breadcrumb: ['Shed'],
        breadcrumbDisplay: 'Shed',
      },
    ];

    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: mockSearchData,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Other');

    const openLink = screen.getAllByRole('link', { name: /Open Box/i })[0];
    expect(openLink).toHaveAttribute('href', '/workspaces/ws-other/containers/box-99');

    // Verify clicking result link executes without throwing ReferenceError
    expect(() => fireEvent.click(openLink)).not.toThrow();
  });

  it('renders and allows clicking both ITEM and CONTAINER search result cards without throwing ReferenceError', () => {
    const mockResults: useSearchModule.SearchResult[] = [
      {
        resultType: 'ITEM',
        workspaceId: 'ws-1',
        workspaceName: 'Home Workspace',
        itemId: 'item-101',
        itemName: 'Camping Lantern',
        quantity: 2,
        containerId: 'box-101',
        boxNumber: 101,
        boxDisplayId: 'BOX 101',
        breadcrumb: ['Garage'],
        breadcrumbDisplay: 'Garage',
      },
      {
        resultType: 'CONTAINER',
        workspaceId: 'ws-1',
        workspaceName: 'Home Workspace',
        containerId: 'box-102',
        boxNumber: 102,
        boxDisplayId: 'BOX 102',
        containerName: 'Winter Storage',
        breadcrumb: ['Attic'],
        breadcrumbDisplay: 'Attic',
      },
    ];

    vi.spyOn(useSearchModule, 'useGlobalSearch').mockReturnValue({
      data: mockResults,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderComponent('Storage');

    const openBoxLinks = screen.getAllByRole('link', { name: /Open Box/i });
    expect(openBoxLinks.length).toBeGreaterThan(0);

    // Verify clicking desktop and mobile result links does not throw ReferenceError: handleResultClick is not defined
    openBoxLinks.forEach((link) => {
      expect(() => fireEvent.click(link)).not.toThrow();
    });
  });
});

