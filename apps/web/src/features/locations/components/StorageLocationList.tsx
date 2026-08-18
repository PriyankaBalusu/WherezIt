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
    return <div>Loading storage locations...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: 'red' }}>
        <p>Error loading locations: {(error as Error)?.message}</p>
        <button onClick={() => refetch()}>Retry</button>
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
      <ul style={{ listStyleType: 'none', paddingLeft: depth === 0 ? 0 : '1.5rem', marginTop: '0.5rem' }}>
        {nodes.map((node) => (
          <li key={node.id} style={{ marginBottom: '0.8rem', padding: '0.5rem', backgroundColor: '#fdfdfd', border: '1px solid #eee', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {editingId === node.id ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    style={{ padding: '0.2rem 0.4rem' }}
                  />
                  <button onClick={() => handleRename(node.id)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>{node.name}</span>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                <button
                  onClick={() => {
                    setSelectedParentId(node.id);
                  }}
                >
                  + Sub-location
                </button>

                <button
                  onClick={() => {
                    setEditingId(node.id);
                    setEditingName(node.name);
                  }}
                >
                  Rename
                </button>

                {node.parentId !== null && (
                  <button onClick={() => handleMove(node.id, null)}>Move to Root</button>
                )}

                <button onClick={() => handleDelete(node.id)} style={{ color: '#c0392b' }}>
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
    <div className="storage-locations-container" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
      <h3 style={{ marginTop: 0 }}>Storage Hierarchy</h3>

      {actionError && (
        <div style={{ color: '#c0392b', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#fdf0ed', borderRadius: '4px' }}>
          {actionError}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={selectedParentId ? 'Add sub-location name...' : 'Add root location (e.g. Garage)...'}
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          style={{ padding: '0.5rem', width: '250px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        {selectedParentId && (
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            Under: {locations.find((l) => l.id === selectedParentId)?.name}
            <button
              type="button"
              onClick={() => setSelectedParentId(null)}
              style={{ marginLeft: '0.4rem', cursor: 'pointer' }}
            >
              Clear
            </button>
          </span>
        )}
        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
          Add Location
        </button>
      </form>

      {locations.length === 0 ? (
        <p style={{ color: '#666' }}>No storage locations yet. Create your first root location above.</p>
      ) : (
        renderTree(null, 0)
      )}
    </div>
  );
};
