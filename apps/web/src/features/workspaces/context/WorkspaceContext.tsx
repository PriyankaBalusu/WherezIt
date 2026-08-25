import React, { createContext, useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Workspace } from '../types/workspace';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { WorkspaceLoadingState } from '../components/WorkspaceLoadingState';
import { WorkspaceErrorState } from '../components/WorkspaceErrorState';
import { ZeroWorkspaceState } from '../components/ZeroWorkspaceState';
import { WorkspaceSelector } from '../components/WorkspaceSelector';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';
import { WorkspaceHome } from '../components/WorkspaceHome';
import { AccountMenu } from '../../auth/components/AccountMenu';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  openCreateWorkspaceModal: () => void;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (workspaces.length > 0) {
      if (!activeWorkspaceId || !workspaces.some((w) => w.id === activeWorkspaceId)) {
        setActiveWorkspaceId(workspaces[0].id);
      }
    } else {
      setActiveWorkspaceId('');
    }
  }, [workspaces, activeWorkspaceId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  const handleSelectWorkspace = (newId: string) => {
    if (newId !== activeWorkspaceId) {
      setActiveWorkspaceId(newId);
      // Safe navigation on workspace switch: if currently on detail route, reset to root
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        window.location.href = '/';
      }
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspaceId: handleSelectWorkspace,
        openCreateWorkspaceModal: () => setIsCreateModalOpen(true),
      }}
    >
      <div className="workspace-layout" style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <header
          className="workspace-nav"
          style={{
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            borderBottom: '1px solid #1e293b',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div className="nav-left" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', color: '#ffffff' }}>
              <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.025em' }}>WherezIt</span>
            </Link>

            {workspaces.length > 0 && activeWorkspace && (
              <WorkspaceSelector
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspace.id}
                onSelectWorkspace={handleSelectWorkspace}
                onCreateWorkspace={() => setIsCreateModalOpen(true)}
              />
            )}

            {activeWorkspace && (
              <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link
                  to={`/workspaces/${activeWorkspace.id}/quick-pack`}
                  style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700 }}
                >
                  Moving Assistant
                </Link>
                <Link
                  to="/scan"
                  style={{ color: '#f8fafc', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  📷 Scan
                </Link>
              </nav>
            )}
          </div>

          <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AccountMenu />
          </div>
        </header>

        <main className="workspace-main" style={{ flex: 1 }}>
          {isLoading ? (
            <WorkspaceLoadingState />
          ) : isError ? (
            <WorkspaceErrorState error={error as Error} onRetry={() => refetch()} />
          ) : workspaces.length === 0 ? (
            <ZeroWorkspaceState />
          ) : (
            children || <WorkspaceHome activeWorkspace={activeWorkspace} />
          )}
        </main>

        <CreateWorkspaceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(newWorkspaceId) => {
            setActiveWorkspaceId(newWorkspaceId);
            refetch();
          }}
        />
      </div>
    </WorkspaceContext.Provider>
  );
};
