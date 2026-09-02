import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useArchiveContainer, useRestoreContainer } from './useContainers';

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    getIdToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

vi.mock('../api/containerApi', () => ({
  archiveContainer: vi.fn().mockImplementation((workspaceId: string, containerId: string) =>
    Promise.resolve({
      id: containerId,
      workspaceId,
      boxNumber: 1,
      isArchived: true,
      name: 'Test Box',
    })
  ),
  restoreContainer: vi.fn().mockImplementation((workspaceId: string, containerId: string) =>
    Promise.resolve({
      id: containerId,
      workspaceId,
      boxNumber: 1,
      isArchived: false,
      name: 'Test Box',
    })
  ),
}));

describe('useContainers archive/restore cache synchronization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('updates single container query cache and invalidates container queries on archive success', async () => {
    const workspaceId = 'ws-123';
    const containerId = 'box-456';

    queryClient.setQueryData(['container', workspaceId, containerId], {
      id: containerId,
      workspaceId,
      isArchived: false,
      name: 'Test Box',
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useArchiveContainer(workspaceId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(containerId);
    });

    const cached = queryClient.getQueryData<any>(['container', workspaceId, containerId]);
    expect(cached.isArchived).toBe(true);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['containers', workspaceId] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['container', workspaceId, containerId] });
  });

  it('updates single container query cache and invalidates container queries on restore success', async () => {
    const workspaceId = 'ws-123';
    const containerId = 'box-456';

    queryClient.setQueryData(['container', workspaceId, containerId], {
      id: containerId,
      workspaceId,
      isArchived: true,
      name: 'Test Box',
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRestoreContainer(workspaceId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(containerId);
    });

    const cached = queryClient.getQueryData<any>(['container', workspaceId, containerId]);
    expect(cached.isArchived).toBe(false);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['containers', workspaceId] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['container', workspaceId, containerId] });
  });
});
