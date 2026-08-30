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
});
