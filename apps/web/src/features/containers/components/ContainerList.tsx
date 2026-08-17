import React, { useState } from 'react';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import {
  useContainers,
  useCreateContainer,
  useUpdateContainer,
  useArchiveContainer,
  useRestoreContainer,
} from '../hooks/useContainers';

interface ContainerListProps {
  workspaceId: string;
}

export const ContainerList: React.FC<ContainerListProps> = ({ workspaceId }) => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filterStorageNodeId, setFilterStorageNodeId] = useState<string | undefined>(undefined);

  const { data: locations = [] } = useStorageLocations(workspaceId);
  const { data: containers = [], isLoading, isError, error, refetch } = useContainers(
    workspaceId,
    filterStorageNodeId,
    includeArchived
  );

  const createMutation = useCreateContainer(workspaceId);
  const updateMutation = useUpdateContainer(workspaceId);
  const archiveMutation = useArchiveContainer(workspaceId);
  const restoreMutation = useRestoreContainer(workspaceId);

  const [selectedStorageNodeId, setSelectedStorageNodeId] = useState<string>('');
  const [newContainerName, setNewContainerName] = useState('');
  const [newContainerDesc, setNewContainerDesc] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return <div>Loading containers...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: 'red' }}>
        <p>Error loading containers: {(error as Error)?.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!selectedStorageNodeId) {
      setActionError('Please select a storage location for the container.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        storageNodeId: selectedStorageNodeId,
        name: newContainerName.trim() || undefined,
        description: newContainerDesc.trim() || undefined,
      });
      setNewContainerName('');
      setNewContainerDesc('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to create container.');
    }
  };

  const handleUpdate = async (id: string) => {
    setActionError(null);
    try {
      await updateMutation.mutateAsync({
        containerId: id,
        data: {
          name: editingName.trim() || undefined,
          description: editingDesc.trim() || undefined,
        },
      });
      setEditingId(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update container.');
    }
  };

  const handleArchiveToggle = async (containerId: string, isArchived: boolean) => {
    setActionError(null);
    try {
      if (isArchived) {
        await restoreMutation.mutateAsync(containerId);
      } else {
        await archiveMutation.mutateAsync(containerId);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle archive state.');
    }
  };

  const getLocationName = (nodeId: string) => {
    return locations.find((l) => l.id === nodeId)?.name || nodeId;
  };

  return (
    <div className="containers-management-container" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e0e0e0', marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Containers</h3>
        <label style={{ fontSize: '0.85rem', color: '#555', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            style={{ marginRight: '0.4rem' }}
          />
          Include Archived Containers
        </label>
      </div>

      {actionError && (
        <div style={{ color: '#c0392b', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#fdf0ed', borderRadius: '4px' }}>
          {actionError}
        </div>
      )}

      {/* Create Container Form */}
      <form onSubmit={handleCreate} style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <select
          value={selectedStorageNodeId}
          onChange={(e) => setSelectedStorageNodeId(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">-- Select Location --</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Container Name (e.g. Holiday Decor)..."
          value={newContainerName}
          onChange={(e) => setNewContainerName(e.target.value)}
          style={{ padding: '0.5rem', width: '220px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <input
          type="text"
          placeholder="Description (optional)..."
          value={newContainerDesc}
          onChange={(e) => setNewContainerDesc(e.target.value)}
          style={{ padding: '0.5rem', width: '220px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
          Create Container
        </button>
      </form>

      {/* Container List Grid */}
      {containers.length === 0 ? (
        <p style={{ color: '#666' }}>No containers found. Create your first container above.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {containers.map((container) => (
            <div
              key={container.id}
              style={{
                padding: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                backgroundColor: container.isArchived ? '#f1f5f9' : '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                opacity: container.isArchived ? 0.75 : 1,
              }}
            >
              {editingId === container.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Container Name"
                    style={{ padding: '0.3rem' }}
                  />
                  <input
                    type="text"
                    value={editingDesc}
                    onChange={(e) => setEditingDesc(e.target.value)}
                    placeholder="Description"
                    style={{ padding: '0.3rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleUpdate(container.id)}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '1rem',
                        borderRadius: '4px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {container.boxId}
                    </span>
                    {container.isArchived && (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>[ARCHIVED]</span>
                    )}
                  </div>

                  <h4 style={{ margin: '0.4rem 0 0.2rem 0', color: '#1e293b' }}>{container.name || 'Unnamed Container'}</h4>
                  {container.description && <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>{container.description}</p>}

                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.8rem' }}>
                    Location: <strong>{getLocationName(container.storageNodeId)}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <button
                      onClick={() => {
                        setEditingId(container.id);
                        setEditingName(container.name || '');
                        setEditingDesc(container.description || '');
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleArchiveToggle(container.id, container.isArchived)}
                      style={{ color: container.isArchived ? '#059669' : '#dc2626' }}
                    >
                      {container.isArchived ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
