import React, { createContext, useContext, useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Workspace } from '../types/workspace';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { WorkspaceLoadingState } from '../components/WorkspaceLoadingState';
import { WorkspaceErrorState } from '../components/WorkspaceErrorState';
import { ZeroWorkspaceState } from '../components/ZeroWorkspaceState';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';
import { WorkspaceHome } from '../components/WorkspaceHome';
import { AccountMenu } from '../../auth/components/AccountMenu';
import { MobileBottomNav } from '../../navigation/components/MobileBottomNav';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  openCreateWorkspaceModal: () => void;
}

const defaultWorkspaceContextValue: WorkspaceContextType = {
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  openCreateWorkspaceModal: () => {},
};

const WorkspaceContext = createContext<WorkspaceContextType>(defaultWorkspaceContextValue);

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  return context || defaultWorkspaceContextValue;
};

export const WorkspaceProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { data: workspaces = [], isLoading, isError, error, refetch } = useWorkspaces();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState<boolean>(false);
  const navMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workspaces.length > 0) {
      if (!activeWorkspaceId || !workspaces.some((w) => w.id === activeWorkspaceId)) {
        setActiveWorkspaceId(workspaces[0].id);
      }
    } else {
      setActiveWorkspaceId('');
    }
  }, [workspaces, activeWorkspaceId]);

  useEffect(() => {
    if (!isNavMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setIsNavMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNavMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNavMenuOpen]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  const handleSelectWorkspace = (newId: string) => {
    if (newId !== activeWorkspaceId) {
      setActiveWorkspaceId(newId);
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
      <div className="workspace-layout" style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column' }}>
        <header className="workspace-nav">
          <div className="nav-container">
            <div className="nav-brand">
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', color: '#ffffff' }}>
                <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '30px', height: '30px', borderRadius: '8px' }} />
                <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.025em' }}>WherezIt</span>
              </Link>
            </div>

            {activeWorkspace && (
              <div className="nav-center">
                {/* Desktop Quick Links */}
                <nav className="nav-quick-links nav-quick-links-desktop">
                  <NavLink
                    to={`/workspaces/${activeWorkspace.id}/moving-assistant`}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    Moving Assistant
                  </NavLink>
                  <NavLink
                    to="/scan"
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    📷 Scan
                  </NavLink>
                </nav>
              </div>
            )}

            <div className="nav-right">
              <AccountMenu />
            </div>
          </div>
        </header>

        <main className="workspace-main" style={{ flex: 1, paddingBottom: '3.5rem' }}>
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

        {/* Global Mobile Bottom Navigation Bar */}
        <MobileBottomNav />
      </div>
    </WorkspaceContext.Provider>
  );
};
