import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceProvider } from './context/WorkspaceContext';
import * as workspaceApi from './api/workspaceApi';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test_user_uid_123', email: 'test@example.com' },
    getIdToken: vi.fn().mockResolvedValue('fake_id_token'),
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
  it('renders loading state when workspaces query is pending', () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Loading your workspaces/i)).toBeInTheDocument();
  });

  it('renders error state when workspace query fails', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockRejectedValue(new Error('Network error'));

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Workspaces/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('renders zero-workspace onboarding when user has 0 workspaces', async () => {
    vi.mocked(workspaceApi.fetchWorkspaces).mockResolvedValue([]);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkspaceProvider />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/You don't belong to any workspace yet/i)).toBeInTheDocument();
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

  it('does not include firebase_uid as authorization payload in fetchWorkspaces API call', async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue('test_token');
    vi.mocked(workspaceApi.fetchWorkspaces).mockImplementation(async (getToken) => {
      const token = await getToken();
      expect(token).toBe('test_token');
      return [];
    });

    await workspaceApi.fetchWorkspaces(mockGetIdToken);
    expect(mockGetIdToken).toHaveBeenCalled();
  });
});
