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
    <div ref={containerRef} className="workspace-selector" style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select active storage space"
        className="workspace-selector__button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          width: '100%',
          backgroundColor: 'var(--color-input-bg, #ffffff)',
          color: 'var(--color-text, #0f172a)',
          border: '1px solid var(--color-input-border, #cbd5e1)',
          borderRadius: '0.5rem',
          padding: '0.45rem 0.75rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.05))',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', minWidth: 0 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>🏠</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeWorkspace ? activeWorkspace.name : 'Select Storage Space'}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', flexShrink: 0, marginLeft: '0.25rem' }}>▼</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.375rem)',
            left: 0,
            width: '100%',
            minWidth: '220px',
            backgroundColor: 'var(--color-dropdown-bg, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-dropdown-border, #cbd5e1)',
            boxShadow: 'var(--color-card-shadow, 0 10px 25px -5px rgba(15, 23, 42, 0.12))',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Storage Spaces
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    backgroundColor: isSelected ? 'var(--color-bg-subtle, #f0f9ff)' : 'transparent',
                    color: isSelected ? 'var(--color-primary-text, #0284c7)' : 'var(--color-text, #334155)',
                    fontWeight: isSelected ? 700 : 400,
                    border: 'none',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {ws.name}
                  </span>
                  {isSelected && <span style={{ color: 'var(--color-primary-text, #0284c7)', fontSize: '0.85rem' }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ padding: '0.375rem', borderTop: '1px solid var(--color-border-subtle, #f1f5f9)', backgroundColor: 'var(--color-bg-subtle, #f8fafc)' }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreateWorkspace();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                width: '100%',
                padding: '0.375rem 0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-primary-text, #0284c7)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              <span>+</span> Create Storage Space
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
