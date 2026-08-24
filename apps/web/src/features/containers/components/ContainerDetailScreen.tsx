import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useContainer, useUpdateContainer, useArchiveContainer, useRestoreContainer } from '../hooks/useContainers';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import { ItemList } from '../../items/components/ItemList';
import { PrintQrLabelModal } from '../../identifiers/components/PrintQrLabelModal';
import { PrintBarcodeLabelModal } from '../../identifiers/components/PrintBarcodeLabelModal';
import { compressImage } from '../../images/utils/compressImage';
import { useAuth } from '../../auth/useAuth';

export const ContainerDetailScreen: React.FC = () => {
  const { workspaceId, containerId } = useParams<{ workspaceId: string; containerId: string }>();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const { data: container, isLoading: isContainerLoading, isError: isContainerError, error: containerError } = useContainer(workspaceId, containerId);
  const { data: locations = [] } = useStorageLocations(workspaceId || '');

  const updateMutation = useUpdateContainer(workspaceId || '');
  const archiveMutation = useArchiveContainer(workspaceId || '');
  const restoreMutation = useRestoreContainer(workspaceId || '');

  // Modals state
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Form states
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [newLocationId, setNewLocationId] = useState('');

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (isContainerLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading box details...</div>;
  }

  if (isContainerError || !container) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', textAlign: 'center' }}>
        <h3 style={{ color: '#dc2626', marginTop: 0 }}>Error Loading Box</h3>
        <p style={{ color: '#7f1d1d' }}>{(containerError as Error)?.message || 'Box details not found.'}</p>
        <Link to="/" className="btn-secondary" style={{ marginTop: '1rem' }}>Back to Home</Link>
      </div>
    );
  }

  // Calculate breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs = [];
    let currentId: string | null | undefined = container.storageNodeId;
    while (currentId) {
      const currentLoc = locations.find((l) => l.id === currentId);
      if (!currentLoc) break;
      crumbs.unshift(currentLoc);
      currentId = currentLoc.parentId;
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        containerId: container.id,
        data: {
          name: editName.trim() || undefined,
          description: editDesc.trim() || undefined,
          movingPriority: editPriority || undefined,
        },
      });
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update box details.');
    }
  };


  const handleMoveContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationId) return;
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId!)}/containers/${encodeURIComponent(container.id)}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destinationStorageNodeId: newLocationId }),
      });
      if (!response.ok) {
        throw new Error('Failed to move box to location');
      }
      setIsMoving(false);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to move box.');
    }
  };

  const handleArchiveToggle = async () => {
    try {
      if (container.isArchived) {
        await restoreMutation.mutateAsync(container.id);
      } else {
        await archiveMutation.mutateAsync(container.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to change archive state.');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed.file);
      const token = await getIdToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId!)}/containers/${encodeURIComponent(container.id)}/captures`, {


        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload photo for AI processing.');
      }

      const data = await response.json();
      if (data.captureId) {
        navigate(`/workspaces/${workspaceId}/captures/${data.captureId}/review`);
      } else {
        throw new Error('No capture job returned.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
      setIsUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: 0, gap: '0.5rem', alignItems: 'center' }}>
          <li>
            <Link to="/" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}>Home</Link>
          </li>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <li style={{ color: '#cbd5e1' }}>/</li>
              <li style={{ fontWeight: idx === breadcrumbs.length - 1 ? 600 : 500 }}>
                {crumb.name}
              </li>
            </React.Fragment>
          ))}
          <li style={{ color: '#cbd5e1' }}>/</li>
          <li aria-current="page" style={{ fontWeight: 700, color: '#0f172a' }}>{container.boxId}</li>
        </ol>
      </nav>

      {/* Box Info Header Card */}
      <section className="card" style={{ padding: '1.75rem', marginBottom: '2rem', borderLeft: '5px solid #0284c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-boxid" style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem', marginBottom: '0.5rem' }}>
              {container.boxId}
            </span>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, margin: '0.25rem 0 0.5rem 0', color: '#0f172a' }}>
              {container.name || 'Unnamed Box'}
            </h1>
            <div style={{ fontSize: '0.95rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
              <span>📍 Location: <strong>{breadcrumbs.map(c => c.name).join(' → ') || 'Root'}</strong></span>
              {container.description && <span style={{ color: '#cbd5e1' }}>•</span>}
              {container.description && <span style={{ color: '#64748b' }}>{container.description}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Main Two Column Detail Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
        {/* Left Column: Trusted Content Items List */}
        <div>
          <ItemList
            workspaceId={workspaceId!}
            containerId={container.id}
            isContainerArchived={container.isArchived}
          />
        </div>

        {/* Right Column: Actions Pane */}
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Quick Actions Panel */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              Box Actions
            </h3>

            {/* AI Image Scan Upload Action */}
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                📷 Add via Container Photo
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                AI can suggest items from a container photo for your review.
              </p>
              <label className="btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', gap: '0.375rem', width: '100%', boxSizing: 'border-box', justifyContent: 'center' }}>
                {isUploading ? 'Uploading to AI...' : 'Upload Container Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={isUploading || container.isArchived}
                  style={{ display: 'none' }}
                />
              </label>
              {uploadError && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem' }}>{uploadError}</div>
              )}
            </div>

            {/* Location Move & Info Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => {
                  setNewLocationId(container.storageNodeId);
                  setIsMoving(!isMoving);
                  setIsEditing(false);
                }}
                style={{ justifyContent: 'flex-start', gap: '0.5rem', width: '100%' }}
              >
                📦 Move Box Location
              </button>

              {isMoving && (
                <form onSubmit={handleMoveContainer} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Select New Storage Location</label>
                    <select
                      value={newLocationId}
                      onChange={(e) => setNewLocationId(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.375rem' }}
                      required
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Move Box</button>
                    <button type="button" className="btn-secondary" onClick={() => setIsMoving(false)} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Cancel</button>
                  </div>
                </form>
              )}

              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => {
                  setEditName(container.name || '');
                  setEditDesc(container.description || '');
                  setEditPriority(container.movingPriority || '');
                  setIsEditing(!isEditing);
                  setIsMoving(false);
                }}
                style={{ justifyContent: 'flex-start', gap: '0.5rem', width: '100%' }}
              >
                ✏️ Edit Box Details
              </button>

              {isEditing && (
                <form onSubmit={handleUpdateInfo} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.375rem', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Box Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.375rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Description</label>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.375rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Save Details</button>
                    <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Identifiers Label Printing Panel */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              Identifiers
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Generate, print, or view physical labels to easily retrieve this container from storage.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => setIsQrOpen(true)}
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
              >
                Print QR Code
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => setIsBarcodeOpen(true)}
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
              >
                Print Barcode
              </button>
            </div>
          </div>

          {/* Secondary / Danger Zone Panel */}
          <div className="card" style={{ padding: '1.5rem', border: '1px solid #fca5a5' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 700, color: '#dc2626' }}>
              Danger Zone
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Archive this container to temporarily hide it from your primary storage view.
            </p>
            <button
              type="button"
              className={container.isArchived ? 'btn-primary' : 'btn-danger'}
              onClick={handleArchiveToggle}
              style={{ padding: '0.5rem 1rem', width: '100%', fontSize: '0.85rem' }}
            >
              {container.isArchived ? 'Restore Container' : 'Archive Container'}
            </button>
          </div>
        </div>
      </div>

      {/* Label Printing Modals */}
      {isQrOpen && (
        <PrintQrLabelModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          onClose={() => setIsQrOpen(false)}
        />
      )}

      {isBarcodeOpen && (
        <PrintBarcodeLabelModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          isOpen={isBarcodeOpen}
          onClose={() => setIsBarcodeOpen(false)}
        />
      )}
    </div>
  );
};
