import React, { useState, useRef, useEffect } from 'react';
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

  const menuRef = useRef<HTMLDivElement>(null);
  const renameMutation = useRenameWorkspace();
  const deleteMutation = useDeleteWorkspace();

  useEffect(() => {
    setNewName(workspace.name);
  }, [workspace.name]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

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
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        type="button"
        aria-label="Manage storage space options"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary btn--icon-md"
        style={{
          width: '36px',
          height: '36px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          color: '#64748b',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.375rem',
        }}
      >
        ⋯
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.375rem',
            width: '200px',
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0',
            zIndex: 50,
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
              color: '#0f172a',
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
              color: '#dc2626',
              cursor: 'pointer',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            🗑️ Delete Storage Space
          </button>
        </div>
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
