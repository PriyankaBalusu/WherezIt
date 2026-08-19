import React, { useState } from 'react';
import {
  useStorageLocations,
  useCreateStorageLocation,
  useRenameStorageLocation,
  useDeleteStorageLocation,
  useMoveStorageLocation,
} from '../hooks/useStorageLocations';

interface StorageLocationListProps {
  workspaceId: string;
}

export const StorageLocationList: React.FC<StorageLocationListProps> = ({ workspaceId }) => {
  const { data: locations = [], isLoading, isError, error, refetch } = useStorageLocations(workspaceId);
  const createMutation = useCreateStorageLocation(workspaceId);
  const renameMutation = useRenameStorageLocation(workspaceId);
  const deleteMutation = useDeleteStorageLocation(workspaceId);
  const moveMutation = useMoveStorageLocation(workspaceId);

  const [newLocationName, setNewLocationName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return <div style={{ color: '#64748b', padding: '1rem' }}>Loading storage locations...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: '#dc2626', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fca5a5' }}>
        <p>Error loading locations: {(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn-secondary" style={{ marginTop: '0.5rem' }}>Retry</button>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!newLocationName.trim()) return;

    try {
      await createMutation.mutateAsync({ name: newLocationName.trim(), parentId: selectedParentId });
      setNewLocationName('');
      setSelectedParentId(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create location.');
    }
  };

  const handleRename = async (id: string) => {
    setActionError(null);
    if (!editingName.trim()) return;

    try {
      await renameMutation.mutateAsync({ locationId: id, data: { name: editingName.trim() } });
      setEditingId(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to rename location.');
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete location.');
    }
  };

  const handleMove = async (id: string, targetParentId: string | null) => {
    setActionError(null);
    try {
      await moveMutation.mutateAsync({ locationId: id, data: { parentId: targetParentId } });
    } catch (err: any) {
      setActionError(err.message || 'Failed to move location.');
    }
  };

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const nodes = locations.filter((loc) => loc.parentId === parentId);
    if (nodes.length === 0) return null;

    return (
      <ul style={{ listStyleType: 'none', paddingLeft: depth === 0 ? 0 : '1.25rem', marginTop: '0.5rem', borderLeft: depth > 0 ? '2px solid #e2e8f0' : 'none' }}>
        {nodes.map((node) => (
          <li key={node.id} style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              {editingId === node.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    style={{ padding: '0.375rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                  <button className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleRename(node.id)}>Save</button>
                  <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{depth === 0 ? '🏠' : depth === 1 ? '🗄️' : '📁'}</span>
                  <span style={{ fontWeight: depth === 0 ? 700 : 600, color: '#0f172a', fontSize: '0.95rem' }}>{node.name}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.375rem', fontSize: '0.75rem' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    setSelectedParentId(node.id);
                  }}
                >
                  + Sub-location
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    setEditingId(node.id);
                    setEditingName(node.name);
                  }}
                >
                  Rename
                </button>

                {node.parentId !== null && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleMove(node.id, null)}
                  >
                    Move to Root
                  </button>
                )}

                <button
                  className="btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626' }}
                  onClick={() => handleDelete(node.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {renderTree(node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
        Storage Location Hierarchy
      </h3>

      {actionError && (
        <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#fef2f2', borderRadius: '0.375rem', border: '1px solid #fca5a5', fontSize: '0.875rem' }}>
          {actionError}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={selectedParentId ? 'Add sub-location name...' : 'Add root location (e.g. Garage)...'}
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          style={{ padding: '0.5rem 0.875rem', width: '280px', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
        />
        {selectedParentId && (
          <span style={{ fontSize: '0.875rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Under: <strong>{locations.find((l) => l.id === selectedParentId)?.name}</strong>
            <button
              type="button"
              onClick={() => setSelectedParentId(null)}
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            >
              Clear
            </button>
          </span>
        )}
        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
          + Add Location
        </button>
      </form>

      {locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
          No storage locations yet. Create your first root location above.
        </div>
      ) : (
        renderTree(null, 0)
      )}
    </div>
  );
};
