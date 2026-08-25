import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from './context/WorkspaceContext';
import * as workspaceApi from './api/workspaceApi';

const mockSignOut = vi.fn();

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test_user_uid_123', email: 'test@example.com' },
    getIdToken: vi.fn().mockResolvedValue('fake_id_token'),
    signOut: mockSignOut,
  }),
}));

vi.mock('./api/workspaceApi', () => ({
  fetchWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Workspace Multi-Workspace Selection & Onboarding (WS-UI-002)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading state with authenticated shell header and Sign Out button', () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Main Content</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );


    expect(screen.getByText('WherezIt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Account$/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading your workspaces/i)).toBeInTheDocument();
  });

  it('renders error state with authenticated shell header and Sign Out button', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockRejectedValue(new Error('Network error'));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Main Content</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('WherezIt')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Account$/i })).toBeInTheDocument();
      expect(screen.getByText(/Unable to Load Workspaces/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('renders zero-workspace onboarding within authenticated shell containing Sign Out', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Main Content</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('WherezIt')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Account$/i })).toBeInTheDocument();
      expect(screen.getByText(/Welcome to WherezIt/i)).toBeInTheDocument();
      expect(screen.getByText(/Create Your First Workspace/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Workspace/i })).toBeInTheDocument();
    });
  });

  it('automatically selects single workspace and shows selector button', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([
      { id: 'ws-1', name: 'Sole Workspace', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z' },
    ]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Sole Workspace Content</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Select active storage space/i })).toBeInTheDocument();
      expect(screen.getByText('Sole Workspace')).toBeInTheDocument();
      expect(screen.getByText('Sole Workspace Content')).toBeInTheDocument();
    });
  });

  it('renders selector dropdown and allows switching between multiple workspaces', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([
      { id: 'ws-1', name: 'Home Workspace', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z' },
      { id: 'ws-2', name: 'Office Workspace', role: 'MEMBER', createdAt: '2026-08-15T00:00:00Z' },
    ]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Workspace Body</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Home Workspace')).toBeInTheDocument();
    });

    const selectorBtn = screen.getByRole('button', { name: /Select active storage space/i });
    fireEvent.click(selectorBtn);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Office Workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Office Workspace'));

    await waitFor(() => {
      expect(screen.getAllByText('Office Workspace').length).toBeGreaterThan(0);
    });
  });

  it('opens Create Workspace modal when + Create Workspace action is clicked in dropdown', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([
      { id: 'ws-1', name: 'Home Workspace', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z' },
    ]);
    vi.mocked(workspaceApi.createWorkspace).mockResolvedValue({
      id: 'ws-new',
      name: 'New Workshop',
      role: 'OWNER',
      createdAt: '2026-08-23T00:00:00Z',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Workspace Body</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Home Workspace')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Select active storage space/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /\+ Create Storage Space/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Workspace Name/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Workspace Name/i), { target: { value: 'New Workshop' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create Workspace$/i }));

    await waitFor(() => {
      expect(workspaceApi.createWorkspace).toHaveBeenCalledWith(
        { name: 'New Workshop' },
        expect.any(Function)
      );
    });
  });

  it('invokes signOut when Sign Out button is clicked inside Account menu', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <WorkspaceProvider>
            <div>Workspace Body</div>
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Account$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Account$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Sign Out/i }));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
