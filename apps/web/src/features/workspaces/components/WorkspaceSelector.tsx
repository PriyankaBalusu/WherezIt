import React, { useState, useRef, useEffect } from 'react';
import { Workspace } from '../types/workspace';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!activeWorkspace && workspaces.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="workspace-selector" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select active storage space"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          padding: '0.4rem 0.85rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <span style={{ fontSize: '1rem' }}>🏠</span>
        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeWorkspace ? activeWorkspace.name : 'Select Storage Space'}
        </span>
        <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '0.25rem' }}>▼</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.375rem)',
            left: 0,
            width: '240px',
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Storage Spaces
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  role="menuitem"
                  onClick={() => {
                    onSelectWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#0284c7' : '#334155',
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.name}
                  </span>
                  {isSelected && <span style={{ color: '#0284c7', fontWeight: 800 }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.375rem' }}>
            <button
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onCreateWorkspace();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.625rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#0284c7',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>+</span> Create Storage Space
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
