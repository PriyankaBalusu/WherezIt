import { useQuery } from '@tanstack/react-query';
import { searchGlobalWorkspaces, searchWorkspace, SearchResult } from '../api/searchApi';

export function useGlobalSearch(query: string, enabled: boolean = false) {
  return useQuery<SearchResult[], Error>({
    queryKey: ['globalSearch', query],
    queryFn: () => searchGlobalWorkspaces(query),
    enabled: enabled && Boolean(query.trim()),
  });
}

export function useWorkspaceSearch(workspaceId: string, query: string, enabled: boolean = false) {
  return useQuery<SearchResult[], Error>({
    queryKey: ['workspaceSearch', workspaceId, query],
    queryFn: () => searchWorkspace(workspaceId, query),
    enabled: enabled && Boolean(query.trim()),
  });
}
