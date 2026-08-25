import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useContainer, useUpdateContainer, useArchiveContainer, useRestoreContainer, useDeleteContainer } from '../hooks/useContainers';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import { ItemList } from '../../items/components/ItemList';
import { PrintQrLabelModal } from '../../identifiers/components/PrintQrLabelModal';
import { PrintBarcodeLabelModal } from '../../identifiers/components/PrintBarcodeLabelModal';
import { PrintBoxLabelModal } from '../../identifiers/components/PrintBoxLabelModal';
import { AttachMasterModal } from '../../identifiers/components/AttachMasterModal';
import { AttachCodeModal } from '../../identifiers/components/AttachCodeModal';
import { PhysicalLabelModal } from '../../identifiers/components/PhysicalLabelModal';
import { TakePhotoLabelModal } from '../../identifiers/components/TakePhotoLabelModal';
import { RevokeIdentifierModal } from '../../identifiers/components/RevokeIdentifierModal';
import { useContainerIdentifiers } from '../../identifiers/hooks/useIdentifiers';
import { compressImage } from '../../images/utils/compressImage';
import { useAuth } from '../../auth/useAuth';
import { useContainerImages, useDeleteContainerImage, useUploadContainerImage } from '../hooks/useContainerImages';
import { useWorkspaceContext } from '../../workspaces/context/WorkspaceContext';

export const ContainerDetailScreen: React.FC = () => {
  const { workspaceId, containerId } = useParams<{ workspaceId: string; containerId: string }>();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);

  const { data: container, isLoading: isContainerLoading, isError: isContainerError, error: containerError } = useContainer(workspaceId, containerId);
  const { data: locations = [] } = useStorageLocations(workspaceId || '');
  const { data: referenceImages = [] } = useContainerImages(workspaceId || '', containerId || '');
  const { data: identifiers = [] } = useContainerIdentifiers(workspaceId, containerId);
  const deleteImageMutation = useDeleteContainerImage(workspaceId || '', containerId || '');
  const uploadReferenceImageMutation = useUploadContainerImage(workspaceId || '', containerId || '');

  const updateMutation = useUpdateContainer(workspaceId || '');
  const archiveMutation = useArchiveContainer(workspaceId || '');
  const restoreMutation = useRestoreContainer(workspaceId || '');
  const deleteContainerMutation = useDeleteContainer(workspaceId || '');

  const workspaceContext = useWorkspaceContext();
  const isOwner = workspaceContext?.activeWorkspace ? workspaceContext.activeWorkspace.role === 'OWNER' : true;

  // Modals state
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isBoxLabelOpen, setIsBoxLabelOpen] = useState(false);
  const [isAttachMasterOpen, setIsAttachMasterOpen] = useState(false);
  const [isAttachCodeOpen, setIsAttachCodeOpen] = useState(false);
  const [attachCodeType, setAttachCodeType] = useState<'QR' | 'BARCODE'>('QR');
  const [isPhysicalLabelOpen, setIsPhysicalLabelOpen] = useState(false);
  const [isTakePhotoLabelOpen, setIsTakePhotoLabelOpen] = useState(false);
  const [revokeIdentifierTarget, setRevokeIdentifierTarget] = useState<{ id: string; type: 'QR' | 'BARCODE'; value: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isArchiveBoxConfirmOpen, setIsArchiveBoxConfirmOpen] = useState(false);
  const [isDeleteBoxConfirmOpen, setIsDeleteBoxConfirmOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<{ id: string; url: string } | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Form states
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPhysicalLabel, setEditPhysicalLabel] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [newLocationId, setNewLocationId] = useState('');

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'uploading' | 'analyzing' | null>(null);

  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [referenceUploadError, setReferenceUploadError] = useState<string | null>(null);

  if (isContainerLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #cbd5e1', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
        Loading box details...
      </div>
    );
  }

  if (isContainerError || !container) {
    return (
      <div role="alert" style={{ maxWidth: '600px', margin: '3rem auto', padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', textAlign: 'center' }}>
        <h3 style={{ color: '#dc2626', marginTop: 0 }}>
          {isContainerError ? "We couldn't load this box." : "Box not found."}
        </h3>
        <p style={{ color: '#7f1d1d', marginBottom: '1.25rem' }}>
          {(containerError as Error)?.message || 'The requested container could not be found or is unavailable.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
            Try Again
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Back to Storage
          </button>
        </div>
      </div>
    );
  }

  // Calculate breadcrumbs & location path string safely
  const getBreadcrumbs = () => {
    if (!container || !locations) return [];
    const crumbs = [];
    let currentId: string | null | undefined = container.storageNodeId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const currentLoc = locations.find((l) => l.id === currentId);
      if (!currentLoc) break;
      crumbs.unshift(currentLoc);
      currentId = currentLoc.parentId;
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();
  const locationPathString = breadcrumbs.map(c => c?.name || '').filter(Boolean).join(' → ') || (locations.find(l => l.id === container.storageNodeId)?.name) || 'Root';

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        containerId: container.id,
        data: {
          name: editName.trim() || undefined,
          description: editDesc.trim() || undefined,
          physicalLabel: editPhysicalLabel.trim() || undefined,
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
      setIsArchiveBoxConfirmOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to change archive state.');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId || !containerId) return;

    try {
      setIsUploading(true);
      setUploadStep('uploading');
      setUploadError(null);
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed.file);
      const token = await getIdToken();
      setUploadStep('analyzing');

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/captures`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[AI Photo Upload Diagnostic Failure]', {
          status: response.status,
          statusText: response.statusText,
          errorResponseBody: errorText,
          uploadedFileName: compressed.file.name,
          uploadedMimeType: compressed.file.type,
          uploadedSizeBytes: compressed.file.size,
        });
        throw new Error("We couldn't analyze this photo. Try another photo or add the items manually.");
      }

      const data = await response.json();
      if (e.target) e.target.value = '';
      setIsUploading(false);
      setUploadStep(null);

      if (data && data.captureId) {
        navigate(`/workspaces/${workspaceId}/captures/${data.captureId}/review`);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('[AI Photo Upload Error]', { message: err?.message, stack: err?.stack });
      const displayMsg = (err?.message && (err.message.includes('HEIC') || err.message.includes('supported') || err.message.includes('threshold')))
        ? err.message
        : "We couldn't analyze this photo. Try another photo or add the items manually.";
      setUploadError(displayMsg);
      setIsUploading(false);
      setUploadStep(null);
    }
  };

  const triggerPhotoUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleReferencePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId || !containerId) return;

    try {
      setIsUploadingReference(true);
      setReferenceUploadError(null);
      const compressed = await compressImage(file);
      await uploadReferenceImageMutation.mutateAsync(compressed.file);
      if (e.target) e.target.value = '';
    } catch (err: any) {
      console.error('[Reference Photo Upload Error]', err);
      setReferenceUploadError(err?.message || 'Failed to upload reference photo.');
    } finally {
      setIsUploadingReference(false);
    }
  };

  const triggerReferencePhotoUpload = () => {
    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.click();
    }
  };

  const handleConfirmDeleteImage = async () => {
    if (!imageToDelete) return;
    try {
      await deleteImageMutation.mutateAsync(imageToDelete.id);
      setImageToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo.');
    }
  };

  const handlePermanentDelete = async () => {
    if (!container) return;
    try {
      await deleteContainerMutation.mutateAsync(container.id);
      setIsDeleteBoxConfirmOpen(false);
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to permanently delete box.');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handlePhotoUpload}
        disabled={isUploading || container.isArchived}
        style={{ display: 'none' }}
      />

      {/* AI Photo Upload Status / Progress Banner */}
      {isUploading && (
        <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '1rem 1.25rem', borderRadius: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
          <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid #7dd3fc', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span>{uploadStep === 'analyzing' ? '✨ Analyzing photo with AI...' : '📷 Uploading photo...'}</span>
        </div>
      )}

      {/* AI Photo Upload Failure Card */}
      {uploadError && (
        <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '1.25rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>AI Photo Analysis Failed</div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#7f1d1d' }}>{uploadError}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setUploadError(null);
                triggerPhotoUpload();
              }}
              style={{ padding: '0.4rem 0.875rem', fontSize: '0.85rem' }}
            >
              🔄 Try Again
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setUploadError(null);
                window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              style={{ padding: '0.4rem 0.875rem', fontSize: '0.85rem' }}
            >
              ➕ Add Manually
            </button>
          </div>
        </div>
      )}

      {/* 1. Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: 0, gap: '0.5rem', alignItems: 'center' }}>
          <li>
            <Link to="/" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}>Home</Link>
          </li>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <li style={{ color: '#cbd5e1' }}>/</li>
              <li>
                <Link
                  to={`/workspaces/${workspaceId}/locations/${crumb.id}`}
                  style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
                >
                  {crumb.name}
                </Link>
              </li>
            </React.Fragment>
          ))}
          <li style={{ color: '#cbd5e1' }}>/</li>
          <li aria-current="page" style={{ fontWeight: 700, color: '#0f172a' }}>{container.boxId}</li>
        </ol>
      </nav>

      {/* 2. Box Info Header Card */}
      <section className="card" style={{ padding: '1.75rem', marginBottom: '1.75rem', borderLeft: '5px solid #0284c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-boxid" style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem', marginBottom: '0.5rem' }}>
              {container.boxId}
            </span>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, margin: '0.25rem 0 0.5rem 0', color: '#0f172a' }}>
              {container.name || 'Unnamed Box'}
            </h1>
            {container.physicalLabel && (
              <div style={{ fontSize: '0.9rem', color: '#0284c7', fontWeight: 600, marginBottom: '0.5rem' }}>
                🏷️ Physical Label: {container.physicalLabel}
              </div>
            )}
            <div style={{ fontSize: '0.95rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
              <span>📍 <strong>{locationPathString}</strong></span>
              {container.description && <span style={{ color: '#cbd5e1' }}>•</span>}
              {container.description && <span style={{ color: '#64748b' }}>{container.description}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Contents Section */}
      <ItemList
        workspaceId={workspaceId!}
        containerId={container.id}
        isContainerArchived={container.isArchived}
        onAddFromPhoto={triggerPhotoUpload}
      />

      {/* Grid Layout for Actions & Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 4. Box Actions */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              Box Actions
            </h3>
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
                style={{ justifyContent: 'flex-start', width: '100%', padding: '0.625rem 1rem' }}
              >
                📦 Move Box
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
                  setEditPhysicalLabel(container.physicalLabel || '');
                  setEditPriority(container.movingPriority || '');
                  setIsEditing(!isEditing);
                  setIsMoving(false);
                }}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '0.625rem 1rem' }}
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
                    <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Physical Label / Alias</label>
                    <input
                      type="text"
                      placeholder="e.g. Christmas Box, Blue Tote"
                      value={editPhysicalLabel}
                      onChange={(e) => setEditPhysicalLabel(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.375rem' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.125rem', display: 'block' }}>
                      Enter what's written on the physical box, such as 'Christmas Box', 'Blue Tote', or 'Kitchen #2'.
                    </span>
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

          {/* 5. Photos */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              Photos
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Reference photos of this box and its contents.
            </p>

            {/* Hidden reference photo input */}
            <input
              ref={referenceFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              onChange={handleReferencePhotoUpload}
              disabled={isUploadingReference || container.isArchived}
              style={{ display: 'none' }}
            />

            {/* Reference Image Gallery */}
            {referenceImages.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.625rem', marginBottom: '1rem' }}>
                {referenceImages.map((img) => (
                  <div key={img.id} style={{ position: 'relative', borderRadius: '0.375rem', overflow: 'hidden', border: '1px solid #cbd5e1', aspectRatio: '1', backgroundColor: '#f8fafc' }}>
                    <img
                      src={img.url}
                      alt="Box reference photo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => setPreviewImageUrl(img.url)}
                    />
                    {!container.isArchived && (
                      <button
                        type="button"
                        onClick={() => setImageToDelete({ id: img.id, url: img.url })}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(15, 23, 42, 0.75)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          fontSize: '14px',
                          lineHeight: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Delete reference photo"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', marginBottom: '1rem' }}>
                No reference photos yet.
              </div>
            )}

            <button
              type="button"
              className="btn-secondary"
              disabled={isUploadingReference || container.isArchived}
              onClick={triggerReferencePhotoUpload}
              style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            >
              {isUploadingReference ? 'Uploading photo...' : '+ Add Photo'}
            </button>
            {referenceUploadError && (
              <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem' }}>{referenceUploadError}</div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 6. Box Labels & Identifiers */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              Box Labels & Identifiers
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Use what is already on the box or generate WherezIt identifiers.
            </p>

            {/* WherezIt Box ID section */}
            <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>WherezIt ID</span>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', marginTop: '0.125rem' }}>{container.boxId}</div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Permanent box identifier</span>
            </div>

            {/* Physical Label section */}
            <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Physical Label</span>
                {!container.isArchived && (
                  <button
                    type="button"
                    onClick={() => setIsPhysicalLabelOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    {container.physicalLabel ? 'Edit' : '+ Add'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: container.physicalLabel ? '#0369a1' : '#94a3b8', marginTop: '0.25rem' }}>
                {container.physicalLabel ? `🏷️ ${container.physicalLabel}` : 'No physical label added.'}
              </div>
            </div>

            {/* Attached Codes section */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Attached Codes
              </div>

              {identifiers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {identifiers.map((ident) => (
                    <div
                      key={ident.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem',
                        padding: '0.75rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '0.5rem',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {ident.type === 'QR' ? '📱 QR Code' : '║▌ Barcode'}
                        </span>
                        <span style={{
                          fontSize: '0.65rem',
                          backgroundColor: ident.value.startsWith('wzi_') ? '#e0f2fe' : '#fef3c7',
                          color: ident.value.startsWith('wzi_') ? '#0369a1' : '#92400e',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {ident.value.startsWith('wzi_') ? 'Generated' : 'Attached'}
                        </span>
                      </div>

                      <div
                        title={ident.value}
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.75rem',
                          color: '#334155',
                          backgroundColor: '#f8fafc',
                          padding: '0.375rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {ident.value}
                      </div>

                      {!container.isArchived && (
                        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', marginTop: '0.125rem' }}>
                          <button
                            type="button"
                            onClick={() => ident.type === 'QR' ? setIsQrOpen(true) : setIsBarcodeOpen(true)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.375rem',
                              color: '#0284c7',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => ident.type === 'QR' ? setIsQrOpen(true) : setIsBarcodeOpen(true)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.375rem',
                              color: '#475569',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevokeIdentifierTarget({ id: ident.id, type: ident.type as any, value: ident.value })}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #fca5a5',
                              borderRadius: '0.375rem',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                  No codes attached yet.
                </div>
              )}

              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => setIsAttachMasterOpen(true)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}
              >
                + Attach Existing Identifier
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => setIsBoxLabelOpen(true)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', justifyContent: 'flex-start' }}
              >
                🏷️ View / Print Box Label
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => setIsQrOpen(true)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', justifyContent: 'flex-start' }}
              >
                📱 Generate / View QR Code
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={container.isArchived}
                onClick={() => setIsBarcodeOpen(true)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', justifyContent: 'flex-start' }}
              >
                ║▌ Generate / View Barcode
              </button>
            </div>
          </div>

          {/* 7. More Actions (Neutral, replaces Danger Zone) */}
          <div className="card" style={{ padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              More Actions
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {container.isArchived
                ? 'Restore this container to reactivate it, or permanently delete it.'
                : 'Archive this container to hide it from active storage views.'}
            </p>
            {container.isArchived ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleArchiveToggle}
                  style={{ padding: '0.5rem 1rem', width: '100%', fontSize: '0.85rem' }}
                >
                  Restore Box
                </button>
                {isOwner && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setIsDeleteBoxConfirmOpen(true)}
                    style={{ padding: '0.5rem 1rem', width: '100%', fontSize: '0.85rem' }}
                  >
                    Delete Box Permanently
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsArchiveBoxConfirmOpen(true)}
                style={{ padding: '0.5rem 1rem', width: '100%', fontSize: '0.85rem' }}
              >
                Archive Box
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Box Label Modal */}
      {isBoxLabelOpen && (
        <PrintBoxLabelModal
          boxDisplayId={container.boxId}
          boxName={container.name || 'Unnamed Box'}
          locationPath={locationPathString}
          isOpen={isBoxLabelOpen}
          onClose={() => setIsBoxLabelOpen(false)}
        />
      )}

      {/* QR Modal */}
      {isQrOpen && (
        <PrintQrLabelModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          onClose={() => setIsQrOpen(false)}
        />
      )}

      {/* Barcode Modal */}
      {isBarcodeOpen && (
        <PrintBarcodeLabelModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          isOpen={isBarcodeOpen}
          onClose={() => setIsBarcodeOpen(false)}
        />
      )}

      {/* Box Archive Confirmation Modal */}
      {isArchiveBoxConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-box-modal-title"
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 id="archive-box-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: '#0f172a', fontWeight: 700 }}>
              Archive this box?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.5rem', marginTop: 0 }}>
              This box will be hidden from active storage views. You can restore it later.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsArchiveBoxConfirmOpen(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleArchiveToggle}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                Archive Box
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Photo Confirmation Modal */}
      {imageToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-photo-modal-title"
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 id="delete-photo-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: '#dc2626', fontWeight: 700 }}>
              Delete reference photo?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.5rem', marginTop: 0 }}>
              This will permanently delete this photo from WherezIt. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setImageToDelete(null)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDeleteImage}
                disabled={deleteImageMutation.isPending}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                {deleteImageMutation.isPending ? 'Deleting...' : 'Delete Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Box Confirmation Modal */}
      {isDeleteBoxConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-box-modal-title"
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '450px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 id="delete-box-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: '#dc2626', fontWeight: 700 }}>
              Permanently delete {container.boxId}?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem', marginTop: 0 }}>
              Are you sure you want to permanently delete <strong>{container.boxId} {container.name ? `(${container.name})` : ''}</strong>?
            </p>
            <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '0.75rem 1rem', borderRadius: '0.25rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#991b1b' }}>
              <strong>Warning:</strong> All contained items, reference photos, QR/barcode identifiers, and box history will be permanently deleted from WherezIt. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsDeleteBoxConfirmOpen(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handlePermanentDelete}
                disabled={deleteContainerMutation.isPending}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                {deleteContainerMutation.isPending ? 'Deleting...' : 'Delete Box Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach Existing Identifier Master Modal */}
      {isAttachMasterOpen && (
        <AttachMasterModal
          boxDisplayId={container.boxId}
          isOpen={isAttachMasterOpen}
          onClose={() => setIsAttachMasterOpen(false)}
          onSelectOption={(option) => {
            setIsAttachMasterOpen(false);
            if (option === 'SCAN') {
              setAttachCodeType('QR');
              setIsAttachCodeOpen(true);
            } else if (option === 'LABEL') {
              setIsPhysicalLabelOpen(true);
            } else if (option === 'PHOTO') {
              setIsTakePhotoLabelOpen(true);
            }
          }}
        />
      )}

      {/* Attach Code Modal (QR / Barcode) */}
      {isAttachCodeOpen && (
        <AttachCodeModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          initialType={attachCodeType}
          isOpen={isAttachCodeOpen}
          onClose={() => setIsAttachCodeOpen(false)}
        />
      )}

      {/* Physical Label Modal */}
      {isPhysicalLabelOpen && (
        <PhysicalLabelModal
          workspaceId={workspaceId!}
          containerId={container.id}
          currentPhysicalLabel={container.physicalLabel}
          isOpen={isPhysicalLabelOpen}
          onClose={() => setIsPhysicalLabelOpen(false)}
        />
      )}

      {/* Take Photo of Label & OCR Modal */}
      {isTakePhotoLabelOpen && (
        <TakePhotoLabelModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          isOpen={isTakePhotoLabelOpen}
          onClose={() => setIsTakePhotoLabelOpen(false)}
          onSwitchToManual={() => {
            setIsTakePhotoLabelOpen(false);
            setIsPhysicalLabelOpen(true);
          }}
        />
      )}

      {/* Revoke Identifier Confirmation Modal */}
      {revokeIdentifierTarget && (
        <RevokeIdentifierModal
          workspaceId={workspaceId!}
          containerId={container.id}
          boxDisplayId={container.boxId}
          identifierId={revokeIdentifierTarget.id}
          identifierType={revokeIdentifierTarget.type}
          identifierValue={revokeIdentifierTarget.value}
          isOpen={!!revokeIdentifierTarget}
          onClose={() => setRevokeIdentifierTarget(null)}
        />
      )}
      {/* Full-size Reference Photo Preview Modal */}
      {previewImageUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
          onClick={() => setPreviewImageUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              padding: '0.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImageUrl}
              alt="Full reference photo preview"
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '0.5rem', display: 'block' }}
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              title="Close preview"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
