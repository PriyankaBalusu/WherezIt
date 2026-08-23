import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

describe('Workspace UI Foundation (WS-UI-001)', () => {
  it('renders loading state with authenticated shell header and Sign Out button', () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    expect(screen.getByText('WherezIt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading your workspaces/i)).toBeInTheDocument();
  });

  it('renders error state with authenticated shell header and Sign Out button', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockRejectedValue(new Error('Network error'));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('WherezIt')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
      expect(screen.getByText(/Unable to Load Workspaces/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('renders zero-workspace onboarding within authenticated shell containing Sign Out', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('WherezIt')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
      expect(screen.getByText(/Welcome to WherezIt/i)).toBeInTheDocument();
      expect(screen.getByText(/Create Your First Workspace/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Workspace/i })).toBeInTheDocument();
    });
  });

  it('automatically selects single workspace when user has 1 workspace', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([
      { id: 'ws-1', name: 'Sole Workspace', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z' },
    ]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sole Workspace')).toBeInTheDocument();
      expect(screen.getByText(/Role: OWNER/i)).toBeInTheDocument();
    });
  });

  it('renders selector and allows switching between multiple workspaces', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([
      { id: 'ws-1', name: 'Home Workspace', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z' },
      { id: 'ws-2', name: 'Office Workspace', role: 'MEMBER', createdAt: '2026-08-15T00:00:00Z' },
    ]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Home Workspace')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-2' } });

    await waitFor(() => {
      expect(screen.getByText('Office Workspace')).toBeInTheDocument();
      expect(screen.getByText(/Role: MEMBER/i)).toBeInTheDocument();
    });
  });

  it('invokes signOut when Sign Out button is clicked', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
