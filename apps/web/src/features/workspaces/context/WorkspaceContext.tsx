import React, { createContext, useContext, useState, useEffect } from 'react';
import { Workspace } from '../types/workspace';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { WorkspaceLoadingState } from '../components/WorkspaceLoadingState';
import { WorkspaceErrorState } from '../components/WorkspaceErrorState';
import { ZeroWorkspaceState } from '../components/ZeroWorkspaceState';
import { WorkspaceSelector } from '../components/WorkspaceSelector';
import { WorkspaceHome } from '../components/WorkspaceHome';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
};

export const WorkspaceProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { data: workspaces = [], isLoading, isError, error, refetch } = useWorkspaces();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');

  useEffect(() => {
    if (workspaces.length > 0) {
      if (!activeWorkspaceId || !workspaces.some((w) => w.id === activeWorkspaceId)) {
        setActiveWorkspaceId(workspaces[0].id);
      }
    } else {
      setActiveWorkspaceId('');
    }
  }, [workspaces, activeWorkspaceId]);

  if (isLoading) {
    return <WorkspaceLoadingState />;
  }

  if (isError) {
    return <WorkspaceErrorState error={error as Error} onRetry={() => refetch()} />;
  }

  if (workspaces.length === 0) {
    return <ZeroWorkspaceState />;
  }

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspaceId }}>
      <div className="workspace-layout">
        <header className="workspace-nav" style={{ padding: '0.8rem 1.5rem', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="nav-left">
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#2c3e50' }}>WherezIt</span>
          </div>
          <div className="nav-right">
            <WorkspaceSelector
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspace.id}
              onSelectWorkspace={setActiveWorkspaceId}
            />
          </div>
        </header>

        <main className="workspace-main">
          {children || <WorkspaceHome activeWorkspace={activeWorkspace} />}
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
};
