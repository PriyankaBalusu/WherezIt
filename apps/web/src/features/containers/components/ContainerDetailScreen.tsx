import React, { useState, useRef, useEffect } from 'react';
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
import { useContainerImages, useDeleteContainerImage, useUploadContainerImage, usePhysicalLabelImage, useDeleteExistingLabel } from '../hooks/useContainerImages';
import { useWorkspaceContext } from '../../workspaces/context/WorkspaceContext';
import { AuthenticatedImage } from '../../images/components/AuthenticatedImage';
import './ContainerDetailScreen.css';

export const ContainerDetailScreen: React.FC = () => {
  const { workspaceId, containerId } = useParams<{ workspaceId: string; containerId: string }>();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);

  const { data: container, isLoading: isContainerLoading, isError: isContainerError, error: containerError } = useContainer(workspaceId, containerId);
  const { data: locations = [] } = useStorageLocations(workspaceId || '');
  const { data: referenceImages = [] } = useContainerImages(workspaceId || '', containerId || '');
  const { data: labelImage } = usePhysicalLabelImage(workspaceId, containerId);
  const { data: identifiers = [] } = useContainerIdentifiers(workspaceId, containerId);
  const deleteImageMutation = useDeleteContainerImage(workspaceId || '', containerId || '');
  const uploadReferenceImageMutation = useUploadContainerImage(workspaceId || '', containerId || '');
  const deleteExistingLabelMutation = useDeleteExistingLabel(workspaceId || '', containerId || '');

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
  const [isRemoveExistingLabelConfirmOpen, setIsRemoveExistingLabelConfirmOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<{ id: string; url: string } | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (galleryIndex === null || referenceImages.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGalleryIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : referenceImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setGalleryIndex((prev) => (prev !== null && prev < referenceImages.length - 1 ? prev + 1 : 0));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [galleryIndex, referenceImages.length]);



  const handleConfirmRemoveExistingLabel = async () => {
    if (!workspaceId || !containerId) return;
    try {
      await deleteExistingLabelMutation.mutateAsync();
      setIsRemoveExistingLabelConfirmOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to remove existing label.');
    }
  };

  // Form states
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [newLocationId, setNewLocationId] = useState('');

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'uploading' | 'analyzing' | null>(null);

  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [referenceUploadError, setReferenceUploadError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  if (isContainerLoading) {
    return (
      <div className="container-detail-loading">
        <div className="spinner container-detail-loading__spinner" />
        Loading box details...
      </div>
    );
  }

  if (isContainerError || !container) {
    return (
      <div role="alert" className="container-detail-error">
        <h3 className="container-detail-error__title">
          {isContainerError ? "We couldn't load this box." : "Box not found."}
        </h3>
        <p className="container-detail-error__msg">
          {(containerError as Error)?.message || 'The requested container could not be found or is unavailable.'}
        </p>
        <div className="container-detail-error__actions">
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
        body: JSON.stringify({ storageNodeId: newLocationId }),
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
    <div className="container-detail-page">
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handlePhotoUpload}
        disabled={isUploading || container.isArchived}
        className="hidden-file-input"
      />

      {/* AI Photo Upload Status / Progress Banner */}
      {isUploading && (
        <div className="container-detail-ai-banner">
          <div className="spinner container-detail-ai-banner__spinner" />
          <span>{uploadStep === 'analyzing' ? '✨ Analyzing photo with AI...' : '📷 Uploading photo...'}</span>
        </div>
      )}

      {/* AI Photo Upload Failure Card */}
      {uploadError && (
        <div role="alert" className="container-detail-error" style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>AI Photo Analysis Failed</div>
          <p className="container-detail-error__msg" style={{ margin: '0 0 1rem 0' }}>{uploadError}</p>
          <div className="container-detail-error__actions" style={{ flexWrap: 'wrap' }}>
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
      <nav aria-label="Breadcrumb" className="container-detail-breadcrumbs">
        <ol className="container-detail-breadcrumbs__list">
          <li>
            <Link to="/" className="container-detail-breadcrumbs__link">Home</Link>
          </li>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <li className="container-detail-breadcrumbs__sep">/</li>
              <li>
                <Link
                  to={`/workspaces/${workspaceId}/locations/${crumb.id}`}
                  className="container-detail-breadcrumbs__link"
                  style={{ fontWeight: 600 }}
                >
                  {crumb.name}
                </Link>
              </li>
            </React.Fragment>
          ))}
          <li className="container-detail-breadcrumbs__sep">/</li>
          <li aria-current="page" className="container-detail-breadcrumbs__current">{container.boxId}</li>
        </ol>
      </nav>


      {/* Hidden Reference Photo Input */}
      <input
        ref={referenceFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleReferencePhotoUpload}
        disabled={isUploadingReference || container.isArchived}
        className="hidden-file-input"
      />

      {/* 2. Box Header Card */}
      <section className="card box-header-card">
        <div className="box-header-card__inner">
          <div>
            <span className="badge badge-boxid box-header-card__badge">
              {container.boxId}
            </span>
            <h1 className="box-header-card__title">
              {container.name || 'Unnamed Box'}
            </h1>
            <div className="box-header-card__meta">
              <span>📍 <strong>{locationPathString}</strong></span>
              {container.description && <span className="box-header-card__meta-sep">•</span>}
              {container.description && <span>{container.description}</span>}
              {container.isPacked && (
                <>
                  <span className="box-header-card__meta-sep">•</span>
                  <span style={{ fontSize: '0.8rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', backgroundColor: '#e2f0d9', color: '#385723', fontWeight: 'bold' }}>
                    Packed
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="box-header-card__actions" ref={menuRef}>
            <button
              type="button"
              className="btn btn-secondary btn--md box-header-edit-desktop box-header-card__btn"
              disabled={container.isArchived}
              onClick={() => {
                setEditName(container.name || '');
                setEditDesc(container.description || '');
                setEditPriority(container.movingPriority || '');
                setIsEditing(!isEditing);
                setIsMoving(false);
                setIsMenuOpen(false);
              }}
            >
              ✏️ Edit Box
            </button>
            <button
              type="button"
              aria-label="Box actions"
              className="btn btn-secondary btn--icon-md box-header-card__menu-trigger"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              ⋮
            </button>

            {isMenuOpen && (
              <div className="box-header-card__dropdown">
                <button
                  type="button"
                  className="box-menu-edit-mobile box-header-card__menu-item"
                  onClick={() => {
                    setEditName(container.name || '');
                    setEditDesc(container.description || '');
                    setEditPriority(container.movingPriority || '');
                    setIsEditing(!isEditing);
                    setIsMoving(false);
                    setIsMenuOpen(false);
                  }}
                  disabled={container.isArchived}
                >
                  ✏️ Edit Box
                </button>
                <button
                  type="button"
                  className="box-header-card__menu-item"
                  onClick={() => {
                    setNewLocationId(container.storageNodeId);
                    setIsMoving(!isMoving);
                    setIsEditing(false);
                    setIsMenuOpen(false);
                  }}
                  disabled={container.isArchived}
                >
                  📦 Move Box
                </button>
                <button
                  type="button"
                  className={`box-header-card__menu-item ${container.isArchived ? 'box-header-card__menu-item--restore' : ''}`}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsArchiveBoxConfirmOpen(true);
                  }}
                >
                  📥 {container.isArchived ? 'Restore Box' : 'Archive Box'}
                </button>
                {container.isArchived && isOwner && (
                  <button
                    type="button"
                    className="box-header-card__menu-item box-header-card__menu-item--danger"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsDeleteBoxConfirmOpen(true);
                    }}
                  >
                    🗑️ Delete Box
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Move Box Form */}
        {isMoving && (
          <form onSubmit={handleMoveContainer} className="box-header-form">
            <div className="form-group box-header-form__group">
              <label className="box-header-form__label">Select New Storage Location</label>
              <select
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                className="box-header-form__select"
                required
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="box-header-form__actions">
              <button type="submit" className="btn-primary box-header-form__btn">Confirm Move</button>
              <button type="button" className="btn-secondary box-header-form__btn" onClick={() => setIsMoving(false)}>Cancel</button>
            </div>
          </form>
        )}

        {/* Edit Details Form */}
        {isEditing && (
          <form onSubmit={handleUpdateInfo} className="box-header-form">
            <div className="form-group box-header-form__group">
              <label className="box-header-form__label">Box Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="box-header-form__input"
              />
            </div>
            <div className="form-group box-header-form__group">
              <label className="box-header-form__label">Description</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="box-header-form__input"
              />
            </div>
            <div className="box-header-form__actions">
              <button type="submit" className="btn-primary box-header-form__btn">Save Details</button>
              <button type="button" className="btn-secondary box-header-form__btn" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      {/* 3. Main Two-Column Grid Layout */}
      <div className="box-detail-grid">
        {/* Left Column: Contents (~55%) */}
        <div className="box-detail-left">
          <ItemList
            workspaceId={workspaceId!}
            containerId={container.id}
            isContainerArchived={container.isArchived}
            onAddFromPhoto={triggerPhotoUpload}
          />
        </div>

        {/* Right Column: Labels & Codes + Photos (~45%) */}
        <div className="box-detail-right">
          {/* Labels & Codes Card */}
          <div className="card labels-codes-card">
            <div className="labels-codes-card__header">
              <h3 className="labels-codes-card__title">
                Labels & Codes
              </h3>
              <p className="labels-codes-card__subtitle">
                Ways to recognize or scan this box.
              </p>
            </div>

            {/* 1. BOX ID Section */}
            <div className="labels-codes-section labels-codes-box-id">
              <div>
                <span className="labels-codes-section__label">BOX ID</span>
                <div className="labels-codes-box-id__value">{container.boxId}</div>
                <span className="labels-codes-box-id__sub">Permanent WherezIt ID</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn--md labels-codes-box-id__print-btn"
                disabled={container.isArchived}
                onClick={() => setIsBoxLabelOpen(true)}
              >
                🏷️ Print Label
              </button>
            </div>

            {/* 2. EXISTING LABEL Section (Rendered only when label text or label photo exists) */}
            {(container.physicalLabel || labelImage) && (
              <div className="labels-codes-section">
                <span className="labels-codes-section__label">
                  EXISTING LABEL
                </span>

                <div>
                  {container.physicalLabel && (
                    <div className="labels-codes-existing__value">
                      🏷️ {container.physicalLabel}
                    </div>
                  )}
                  {labelImage && (
                    <div className="labels-codes-existing__photo-row">
                      <div
                        className="labels-codes-existing__thumb"
                        onClick={() => setPreviewImageUrl(labelImage.url)}
                        title="View photographed label"
                      >
                        <AuthenticatedImage
                          src={labelImage.url}
                          alt="Photographed label"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <span className="labels-codes-existing__photo-caption">From photographed label</span>
                    </div>
                  )}

                  {!container.isArchived && (
                    <div className="labels-codes-existing__btn-row">
                      <button
                        type="button"
                        className="labels-codes-existing__btn"
                        onClick={() => setIsPhysicalLabelOpen(true)}
                      >
                        {container.physicalLabel ? 'Edit Text' : '+ Add Text'}
                      </button>
                      <button
                        type="button"
                        className="labels-codes-existing__btn labels-codes-existing__btn--sec"
                        onClick={() => setIsTakePhotoLabelOpen(true)}
                      >
                        {labelImage ? 'Replace Photo' : 'Add Photo'}
                      </button>
                      <button
                        type="button"
                        className="labels-codes-existing__btn labels-codes-existing__btn--danger"
                        onClick={() => setIsRemoveExistingLabelConfirmOpen(true)}
                        disabled={deleteExistingLabelMutation.isPending}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. SCANNABLE CODES Section */}
            <div className="labels-codes-section labels-codes-section--nobg">
              <span className="labels-codes-section__label">
                SCANNABLE CODES
              </span>

              {identifiers.length > 0 ? (
                <div className="scannable-codes-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {identifiers.map((ident) => (
                    <div key={ident.id} className="scannable-code-card">
                      <div className="scannable-code-card__header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>{ident.type === 'QR' ? '📱' : '║▌'}</span>
                          <span className="scannable-code-card__title">
                            {ident.type === 'QR' ? 'QR Code' : 'Barcode'}
                          </span>
                        </div>
                        <span className="scannable-code-card__badge">
                          GENERATED
                        </span>
                      </div>

                      <div className="scannable-code-card__subtext">
                        Scan to open {container.boxId}
                      </div>

                      {!container.isArchived && (
                        <div className="scannable-code-card__actions">
                          <button
                            type="button"
                            className="scannable-code-card__btn"
                            onClick={() => ident.type === 'QR' ? setIsQrOpen(true) : setIsBarcodeOpen(true)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="scannable-code-card__btn scannable-code-card__btn--print"
                            onClick={() => ident.type === 'QR' ? setIsQrOpen(true) : setIsBarcodeOpen(true)}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="scannable-code-card__btn scannable-code-card__btn--danger"
                            onClick={() => setRevokeIdentifierTarget({ id: ident.id, type: ident.type as any, value: ident.value })}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="scannable-codes-empty">
                  No scannable codes generated.
                </div>
              )}

              {/* Conditional generation actions & attach master */}
              <div className="scannable-codes-gen-actions">
                {!identifiers.some((i) => i.type === 'QR') && !container.isArchived && (
                  <button
                    type="button"
                    className="btn btn-secondary btn--md scannable-codes-gen-btn"
                    onClick={() => setIsQrOpen(true)}
                  >
                    📱 + Generate QR Code
                  </button>
                )}
                {!identifiers.some((i) => i.type === 'BARCODE') && !container.isArchived && (
                  <button
                    type="button"
                    className="btn btn-secondary btn--md scannable-codes-gen-btn"
                    onClick={() => setIsBarcodeOpen(true)}
                  >
                    ║▌ + Generate Barcode
                  </button>
                )}
                {!container.isArchived && (
                  <button
                    type="button"
                    className="btn btn-secondary btn--md scannable-codes-gen-btn"
                    onClick={() => setIsAttachMasterOpen(true)}
                  >
                    + Add Existing Code or Label
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Photos Card */}
          <div className="card photos-card">
            <div className="photos-card-header">
              <div>
                <h3 className="photos-card-title">
                  Photos
                </h3>
                <p className="photos-card-subtitle">
                  Reference photos of this box.
                </p>
              </div>
              {!container.isArchived && (
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  disabled={isUploadingReference}
                  onClick={triggerReferencePhotoUpload}
                >
                  {isUploadingReference ? 'Uploading...' : '+ Add Photo'}
                </button>
              )}
            </div>

            {referenceImages.length > 0 ? (
              <>
                <div className="photos-grid">
                  {referenceImages.slice(0, 4).map((img, idx) => (
                    <div key={img.id} className="photos-grid__thumb-wrapper">
                      <AuthenticatedImage
                        src={img.url}
                        alt="Box reference photo"
                        className="photos-grid__thumb-img"
                        onClick={() => setGalleryIndex(idx)}
                      />
                      {!container.isArchived && (
                        <button
                          type="button"
                          onClick={() => setImageToDelete({ id: img.id, url: img.url })}
                          className="photos-grid__delete-btn"
                          title="Delete reference photo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {referenceImages.length > 4 && (
                  <div className="photos-card__view-all-wrapper">
                    <button
                      type="button"
                      onClick={() => setGalleryIndex(0)}
                      className="photos-card__view-all-btn"
                    >
                      View all photos
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="photos-card__empty">
                No reference photos added yet.
              </div>
            )}
            {referenceUploadError && (
              <div className="photos-card__error">{referenceUploadError}</div>
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
          className="container-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-box-modal-title"
        >
          <div className="container-modal-surface container-modal-surface--md">
            <h3 id="archive-box-modal-title" className="container-modal-title">
              {container.isArchived ? 'Restore this box?' : 'Archive this box?'}
            </h3>
            <p className="container-modal-subtitle">
              {container.isArchived
                ? 'This box will be restored to active storage views.'
                : 'This box will be hidden from active storage views. You can restore it later.'}
            </p>
            <div className="container-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setIsArchiveBoxConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                onClick={handleArchiveToggle}
              >
                {container.isArchived ? 'Restore Box' : 'Archive Box'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Photo Confirmation Modal */}
      {imageToDelete && (
        <div
          className="container-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-photo-modal-title"
        >
          <div className="container-modal-surface container-modal-surface--md">
            <h3 id="delete-photo-modal-title" className="container-modal-title container-modal-title--danger">
              Delete reference photo?
            </h3>
            <p className="container-modal-subtitle">
              This will permanently delete this photo from WherezIt. This action cannot be undone.
            </p>
            <div className="container-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setImageToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn--md"
                onClick={handleConfirmDeleteImage}
                disabled={deleteImageMutation.isPending}
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
          className="container-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-box-modal-title"
        >
          <div className="container-modal-surface container-modal-surface--lg">
            <h3 id="delete-box-modal-title" className="container-modal-title container-modal-title--danger">
              Permanently delete {container.boxId}?
            </h3>
            <p className="container-modal-subtitle">
              Are you sure you want to permanently delete <strong>{container.boxId} {container.name ? `(${container.name})` : ''}</strong>?
            </p>
            <div className="container-modal-warning">
              <strong>Warning:</strong> All contained items, reference photos, QR/barcode identifiers, and box history will be permanently deleted from WherezIt. This action cannot be undone.
            </div>
            <div className="container-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setIsDeleteBoxConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn--md"
                onClick={handlePermanentDelete}
                disabled={deleteContainerMutation.isPending}
              >
                {deleteContainerMutation.isPending ? 'Deleting...' : 'Delete Box Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Existing Label Confirmation Modal */}
      {isRemoveExistingLabelConfirmOpen && (
        <div
          className="container-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-label-modal-title"
        >
          <div className="container-modal-surface">
            <h3 id="remove-label-modal-title" className="container-modal-title container-modal-title--danger">
              Remove Existing Label?
            </h3>
            <p className="container-modal-subtitle" style={{ marginBottom: '1.25rem' }}>
              This will remove the saved label text and label photo from this box.
            </p>
            <div className="container-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setIsRemoveExistingLabelConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn--md"
                onClick={handleConfirmRemoveExistingLabel}
                disabled={deleteExistingLabelMutation.isPending}
              >
                {deleteExistingLabelMutation.isPending ? 'Removing...' : 'Remove Label'}
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
      {/* Reference Photo Gallery Modal */}
      {galleryIndex !== null && referenceImages[galleryIndex] && (
        <div
          className="photo-gallery-backdrop"
          onClick={() => setGalleryIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="photo-gallery-surface" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="photo-gallery-close"
              onClick={() => setGalleryIndex(null)}
              title="Close gallery (Esc)"
            >
              ×
            </button>

            <div className="photo-gallery-main">
              {referenceImages.length > 1 && (
                <button
                  type="button"
                  className="photo-gallery-nav-btn photo-gallery-nav-btn--prev"
                  onClick={() => setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : referenceImages.length - 1))}
                  title="Previous photo (Left Arrow)"
                >
                  ‹
                </button>
              )}
              <AuthenticatedImage
                src={referenceImages[galleryIndex].url}
                alt={`Reference photo ${galleryIndex + 1}`}
                className="photo-gallery-img"
              />
              {referenceImages.length > 1 && (
                <button
                  type="button"
                  className="photo-gallery-nav-btn photo-gallery-nav-btn--next"
                  onClick={() => setGalleryIndex((prev) => (prev !== null && prev < referenceImages.length - 1 ? prev + 1 : 0))}
                  title="Next photo (Right Arrow)"
                >
                  ›
                </button>
              )}
            </div>

            <div className="photo-gallery-info">
              <span>{galleryIndex + 1} of {referenceImages.length}</span>
            </div>

            {referenceImages.length > 1 && (
              <div className="photo-gallery-strip">
                {referenceImages.map((img, idx) => (
                  <AuthenticatedImage
                    key={img.id}
                    src={img.url}
                    alt={`Thumbnail ${idx + 1}`}
                    className={`photo-gallery-strip-thumb ${idx === galleryIndex ? 'photo-gallery-strip-thumb--active' : ''}`}
                    onClick={() => setGalleryIndex(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-size Single Image Preview Modal */}
      {previewImageUrl && (
        <div
          className="container-modal-backdrop"
          onClick={() => setPreviewImageUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="photo-preview-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <AuthenticatedImage
              src={previewImageUrl}
              alt="Full photo preview"
              className="photo-preview-img"
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="photo-preview-close"
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
