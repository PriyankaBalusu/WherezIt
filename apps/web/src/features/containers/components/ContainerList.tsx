import React, { useState } from 'react';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import { CameraCaptureModal } from './CameraCaptureModal';
import { PrintQrLabelModal } from '../../identifiers/components/PrintQrLabelModal';
import { PrintBarcodeLabelModal } from '../../identifiers/components/PrintBarcodeLabelModal';
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
  const [filterStorageNodeId] = useState<string | undefined>(undefined);

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
  const [photoContainerId, setPhotoContainerId] = useState<string | null>(null);

  const [qrModalContainer, setQrModalContainer] = useState<{ id: string; boxId: string } | null>(null);
  const [barcodeModalContainer, setBarcodeModalContainer] = useState<{ id: string; boxId: string } | null>(null);

  if (isLoading) {
    return <div style={{ color: '#64748b', padding: '1rem' }}>Loading containers...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: '#dc2626', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fca5a5' }}>
        <p>Error loading containers: {(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn-secondary" style={{ marginTop: '0.5rem' }}>Retry</button>
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
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Containers</h3>
        <label style={{ fontSize: '0.875rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include Archived Containers
        </label>
      </div>

      {actionError && (
        <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#fef2f2', borderRadius: '0.375rem', border: '1px solid #fca5a5', fontSize: '0.875rem' }}>
          {actionError}
        </div>
      )}

      {/* Create Container Form */}
      <form onSubmit={handleCreate} style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <select
          value={selectedStorageNodeId}
          onChange={(e) => setSelectedStorageNodeId(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
        >
          <option value="">-- Select Storage Location --</option>
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
          style={{ padding: '0.5rem 0.75rem', width: '220px', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
        />

        <input
          type="text"
          placeholder="Description (optional)..."
          value={newContainerDesc}
          onChange={(e) => setNewContainerDesc(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', width: '220px', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
        />

        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
          Create Container
        </button>
      </form>

      {/* Container List Grid */}
      {containers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
          No containers found. Create your first container above.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {containers.map((container) => (
            <div
              key={container.id}
              style={{
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                backgroundColor: container.isArchived ? '#f8fafc' : '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                opacity: container.isArchived ? 0.75 : 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {editingId === container.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Container Name"
                    style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                  />
                  <input
                    type="text"
                    value={editingDesc}
                    onChange={(e) => setEditingDesc(e.target.value)}
                    placeholder="Description"
                    style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn-primary" style={{ padding: '0.375rem 0.75rem' }} onClick={() => handleUpdate(container.id)}>Save</button>
                    <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span className="badge badge-boxid">
                      {container.boxId}
                    </span>

                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      {container.isPacked && (
                        <span className="badge badge-packed">✓ Packed</span>
                      )}
                      {container.movingPriority && (
                        <span className={container.movingPriority === 'HIGH' ? 'badge badge-priority-high' : 'badge badge-priority-medium'}>
                          {container.movingPriority}
                        </span>
                      )}
                      {container.isArchived && (
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>Archived</span>
                      )}
                    </div>
                  </div>

                  <h4 style={{ margin: '0.25rem 0', color: '#0f172a', fontSize: '1.125rem', fontWeight: 700 }}>
                    {container.name || 'Unnamed Container'}
                  </h4>

                  {container.description && (
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
                      {container.description}
                    </p>
                  )}

                  <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                    Location: <strong>{getLocationName(container.storageNodeId)}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setEditingId(container.id);
                        setEditingName(container.name || '');
                        setEditingDesc(container.description || '');
                      }}
                    >
                      Edit
                    </button>

                    {!container.isArchived && (
                      <>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}
                          onClick={() => setPhotoContainerId(container.id)}
                        >
                          📷 Photo
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}
                          onClick={() => setQrModalContainer({ id: container.id, boxId: container.boxId })}
                        >
                          QR
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}
                          onClick={() => setBarcodeModalContainer({ id: container.id, boxId: container.boxId })}
                        >
                          Barcode
                        </button>
                      </>
                    )}

                    <button
                      className="btn-secondary"
                      style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', color: container.isArchived ? '#16a34a' : '#dc2626' }}
                      onClick={() => handleArchiveToggle(container.id, container.isArchived)}
                    >
                      {container.isArchived ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {photoContainerId && (
        <CameraCaptureModal
          workspaceId={workspaceId}
          containerId={photoContainerId}
          isOpen={!!photoContainerId}
          onClose={() => setPhotoContainerId(null)}
        />
      )}

      {qrModalContainer && (
        <PrintQrLabelModal
          workspaceId={workspaceId}
          containerId={qrModalContainer.id}
          boxDisplayId={qrModalContainer.boxId}
          onClose={() => setQrModalContainer(null)}
        />
      )}

      {barcodeModalContainer && (
        <PrintBarcodeLabelModal
          workspaceId={workspaceId}
          containerId={barcodeModalContainer.id}
          boxDisplayId={barcodeModalContainer.boxId}
          isOpen={!!barcodeModalContainer}
          onClose={() => setBarcodeModalContainer(null)}
        />
      )}
    </div>
  );
};
