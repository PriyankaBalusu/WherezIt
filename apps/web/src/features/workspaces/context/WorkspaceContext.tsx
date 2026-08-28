import React, { createContext, useContext, useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
                {workspaces.length > 0 && (
                  <WorkspaceSelector
                    workspaces={workspaces}
                    activeWorkspaceId={activeWorkspace.id}
                    onSelectWorkspace={handleSelectWorkspace}
                    onCreateWorkspace={() => setIsCreateModalOpen(true)}
                  />
                )}
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

                {/* Mobile Quick Links Dropdown Trigger */}
                <div className="nav-quick-links-mobile" ref={navMenuRef}>
                  <button
                    type="button"
                    aria-label="Navigation menu"
                    onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                    className="nav-mobile-trigger"
                  >
                    ⋮
                  </button>
                  {isNavMenuOpen && (
                    <div className="nav-mobile-dropdown">
                      <Link
                        to={`/workspaces/${activeWorkspace.id}/quick-pack`}
                        onClick={() => setIsNavMenuOpen(false)}
                        className="nav-mobile-dropdown-item"
                      >
                        🚚 Moving Assistant
                      </Link>
                      <Link
                        to="/scan"
                        onClick={() => setIsNavMenuOpen(false)}
                        className="nav-mobile-dropdown-item"
                      >
                        📷 Scan
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="nav-right">
              <AccountMenu />
            </div>
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
