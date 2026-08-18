import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSearch } from './components/WorkspaceSearch';
import * as searchApi from './api/searchApi';

vi.mock('./api/searchApi');

describe('WorkspaceSearch (SRCH-002)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (workspaceId = 'ws-123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSearch workspaceId={workspaceId} />
      </QueryClientProvider>
    );
  };

  it('renders search input and submit button in initial idle state', () => {
    renderComponent();
    expect(screen.getByPlaceholderText(/Search items/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument();
  });

  it('executes search on form submit and displays ITEM result with breadcrumb', async () => {
    const mockResults: searchApi.SearchResult[] = [
      {
        resultType: 'ITEM',
        itemId: 'item-1',
        itemName: 'Christmas Lights',
        quantity: 2,
        containerId: 'box-4',
        boxNumber: 4,
        boxDisplayId: 'BOX 004',
        locationId: 'loc-1',
        locationName: 'Shelf 2',
        breadcrumb: ['Garage', 'Rack A', 'Shelf 2'],
        breadcrumbDisplay: 'Garage → Rack A → Shelf 2',
      },
    ];

    vi.mocked(searchApi.searchWorkspace).mockResolvedValueOnce(mockResults);

    renderComponent();

    const input = screen.getByPlaceholderText(/Search items/i);
    fireEvent.change(input, { target: { value: 'Christmas lights' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => {
      expect(screen.getByText('Christmas Lights')).toBeInTheDocument();
    });

    expect(screen.getByText('BOX 004')).toBeInTheDocument();
    expect(screen.getByText('Garage → Rack A → Shelf 2')).toBeInTheDocument();
  });

  it('displays empty state when no matches are found', async () => {
    vi.mocked(searchApi.searchWorkspace).mockResolvedValueOnce([]);

    renderComponent();

    const input = screen.getByPlaceholderText(/Search items/i);
    fireEvent.change(input, { target: { value: 'Nonexistent' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => {
      expect(screen.getByText(/No inventory matching "Nonexistent" was found/i)).toBeInTheDocument();
    });
  });
});
