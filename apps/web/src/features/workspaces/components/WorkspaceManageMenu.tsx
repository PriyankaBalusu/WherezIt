import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Workspace } from '../types/workspace';
import { useRenameWorkspace, useDeleteWorkspace } from '../hooks/useWorkspaces';

interface WorkspaceManageMenuProps {
  workspace: Workspace;
  onRenamed?: () => void;
  onDeleted?: () => void;
}

export const WorkspaceManageMenu: React.FC<WorkspaceManageMenuProps> = ({
  workspace,
  onRenamed,
  onDeleted,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newName, setNewName] = useState(workspace.name);
  const [error, setError] = useState<string | null>(null);

  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameMutation = useRenameWorkspace();
  const deleteMutation = useDeleteWorkspace();

  useEffect(() => {
    setNewName(workspace.name);
  }, [workspace.name]);

  // Position calculation for Portaled Dropdown
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 200;
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 6;
    // Flip above if not enough vertical room below
    if (top + 120 > viewportHeight && rect.top - 120 > margin) {
      top = Math.max(margin, rect.top - 120);
    }

    // Align right edge of menu with right edge of trigger button
    let left = rect.right - menuWidth;
    // Clamp horizontally to stay within viewport bounds
    const maxLeft = Math.max(margin, viewportWidth - menuWidth - margin);
    left = Math.max(margin, Math.min(left, maxLeft));

    setMenuCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Reposition on window resize or scroll
    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    // Prevent immediate close on touch/click propagation by delaying click-outside attachment
    let timerId: ReturnType<typeof setTimeout>;

    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (
        buttonRef.current && buttonRef.current.contains(target) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }
      console.log('[WorkspaceManageMenu Debug] Outside interaction detected, closing menu.');
      setIsOpen(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    timerId = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timerId);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Diagnostic logger for menu rendering
  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      console.log('[WorkspaceManageMenu Diagnostics]', {
        isOpen,
        triggerRect: buttonRef.current.getBoundingClientRect(),
        menuRect: dropdownRef.current.getBoundingClientRect(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        coords: menuCoords,
        inDOM: true,
      });
    }
  }, [isOpen, menuCoords]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextOpen = !isOpen;
    console.log('[WorkspaceManageMenu Debug] Toggle button clicked. Current:', isOpen, 'Next:', nextOpen);
    if (nextOpen) {
      updatePosition();
    }
    setIsOpen(nextOpen);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;

    try {
      await renameMutation.mutateAsync({ workspaceId: workspace.id, name: newName.trim() });
      setIsRenameModalOpen(false);
      setIsOpen(false);
      onRenamed?.();
    } catch (err: any) {
      setError(err.message || 'Failed to rename storage space.');
    }
  };

  const handleDeleteConfirm = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync(workspace.id);
      setIsDeleteModalOpen(false);
      setIsOpen(false);
      onDeleted?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete storage space.');
    }
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Manage storage space options"
        onClick={handleToggle}
        className="btn btn-secondary btn--icon-md"
        style={{
          width: '36px',
          height: '36px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          color: 'var(--color-text-muted, #64748b)',
          backgroundColor: 'var(--color-input-bg, #ffffff)',
          border: '1px solid var(--color-input-border, #cbd5e1)',
          borderRadius: '0.375rem',
        }}
      >
        ⋯
      </button>

      {isOpen && menuCoords && createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Storage space management options"
          style={{
            position: 'fixed',
            top: `${menuCoords.top}px`,
            left: `${menuCoords.left}px`,
            width: '200px',
            maxWidth: 'calc(100vw - 16px)',
            backgroundColor: 'var(--color-dropdown-bg, #ffffff)',
            borderRadius: '0.5rem',
            boxShadow: 'var(--color-card-shadow, 0 10px 25px rgba(0,0,0,0.18))',
            border: '1px solid var(--color-dropdown-border, #cbd5e1)',
            zIndex: 99999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '0.25rem 0',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsRenameModalOpen(true);
              setIsOpen(false);
            }}
            style={{
              padding: '0.625rem 1rem',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--color-text, #0f172a)',
              cursor: 'pointer',
            }}
          >
            ✏️ Rename Storage Space
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDeleteModalOpen(true);
              setIsOpen(false);
            }}
            style={{
              padding: '0.625rem 1rem',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--color-danger, #dc2626)',
              cursor: 'pointer',
              borderTop: '1px solid var(--color-border-subtle, #f1f5f9)',
            }}
          >
            🗑️ Delete Storage Space
          </button>
        </div>,
        document.body
      )}

      {/* Rename Modal */}
      {isRenameModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRenameModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rename Storage Space</h3>
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div className="modal-body">
                {error && <div className="auth-error">{error}</div>}
                <div className="form-group">
                  <label htmlFor="rename-workspace-input">Storage Space Name</label>
                  <input
                    type="text"
                    id="rename-workspace-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsRenameModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={renameMutation.isPending}>
                  {renameMutation.isPending ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Storage Space</h3>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="auth-error">{error}</div>}
              <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>
                Are you sure you want to delete <strong>{workspace.name}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem' }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
