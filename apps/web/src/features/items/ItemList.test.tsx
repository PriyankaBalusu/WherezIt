import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemList } from './components/ItemList';
import * as itemApi from './api/itemApi';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test_user_uid_123', email: 'test@example.com' },
    getIdToken: vi.fn().mockResolvedValue('fake_id_token'),
  }),
}));

vi.mock('./api/itemApi');

describe('ItemList UI (ITEM-001)', () => {
  let queryClient: QueryClient;
  const workspaceId = 'ws-123';
  const containerId = 'box-456';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.resetAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(itemApi, 'getItemsByContainer').mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <QueryClientProvider client={queryClient}>
        <ItemList workspaceId={workspaceId} containerId={containerId} />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Loading items.../i)).toBeInTheDocument();
  });

  it('renders item list when loaded', async () => {
    vi.spyOn(itemApi, 'getItemsByContainer').mockResolvedValue([
      {
        id: 'item-1',
        workspaceId,
        containerId,
        name: 'Christmas Lights',
        quantity: 2,
        source: 'MANUAL',
        isVerified: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <ItemList workspaceId={workspaceId} containerId={containerId} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Christmas Lights')).toBeInTheDocument();
      expect(screen.getByText('Qty: 2')).toBeInTheDocument();
      expect(screen.getByText('✓ Verified')).toBeInTheDocument();
    });
  });

  it('calls createItem API when submitting form', async () => {
    vi.spyOn(itemApi, 'getItemsByContainer').mockResolvedValue([]);
    const createSpy = vi.spyOn(itemApi, 'createItem').mockResolvedValue({
      id: 'item-new',
      workspaceId,
      containerId,
      name: 'Tape Measure',
      quantity: 1,
      source: 'MANUAL',
      isVerified: true,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ItemList workspaceId={workspaceId} containerId={containerId} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Item name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Item name/i), {
      target: { value: 'Tape Measure' },
    });
    fireEvent.submit(screen.getByText('Add Item').closest('form')!);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        workspaceId,
        containerId,
        { name: 'Tape Measure', quantity: 1 },
        'fake_id_token'
      );
    });
  });

  it('shows error when attempting to add item with quantity 0', async () => {
    vi.spyOn(itemApi, 'getItemsByContainer').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <ItemList workspaceId={workspaceId} containerId={containerId} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Item name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Item name/i);
    const qtyInput = screen.getByDisplayValue('1');
    const submitBtn = screen.getByText('Add Item');

    fireEvent.change(nameInput, { target: { value: 'Invalid Item' } });
    fireEvent.change(qtyInput, { target: { value: '0' } });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Quantity must be 1 or greater.');
    });
  });
});
