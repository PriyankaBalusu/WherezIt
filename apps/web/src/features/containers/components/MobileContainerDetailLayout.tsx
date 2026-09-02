import React, { useState, useRef, useEffect } from 'react';
import { ItemList } from '../../items/components/ItemList';
import { AuthenticatedImage } from '../../images/components/AuthenticatedImage';
import { BoxHistoryTimeline } from './BoxHistoryTimeline';

export interface MobileContainerDetailLayoutProps {
  container: any;
  locationPathString: string;
  itemCount: number;
  photoCount: number;
  codeCount: number;
  workspaceId: string;
  containerId: string;
  isOwner: boolean;
  referenceImages: any[];
  labelImage: any;
  identifiers: any[];
  isUploadingReference: boolean;
  onEditBox: () => void;
  onMoveBox: () => void;
  onArchiveBox: () => void;
  onDeleteBox: () => void;
  onTriggerPhotoUpload: () => void;
  onTriggerReferencePhotoUpload: () => void;
  onOpenBoxLabel: () => void;
  onOpenQr: () => void;
  onOpenBarcode: () => void;
  onOpenAttachMaster: () => void;
  onOpenPhysicalLabel: () => void;
  onOpenTakePhotoLabel: () => void;
  onOpenRemoveExistingLabel: () => void;
  onSetRevokeIdentifierTarget: (target: any) => void;
  onSetPreviewImageUrl: (url: string) => void;
  onSetGalleryIndex: (index: number) => void;
  isEditing?: boolean;
  isMoving?: boolean;
  editName?: string;
  editDesc?: string;
  newLocationId?: string;
  locations?: any[];
  onSetEditName?: (val: string) => void;
  onSetEditDesc?: (val: string) => void;
  onSetNewLocationId?: (val: string) => void;
  onSaveEdit?: (e: React.FormEvent) => void;
  onConfirmMove?: (e: React.FormEvent) => void;
  onCancelEdit?: () => void;
  onCancelMove?: () => void;
}

export const MobileContainerDetailLayout: React.FC<MobileContainerDetailLayoutProps> = ({
  container,
  locationPathString,
  itemCount,
  photoCount,
  codeCount,
  workspaceId,
  containerId,
  isOwner,
  referenceImages,
  labelImage,
  identifiers,
  isUploadingReference,
  onEditBox,
  onMoveBox,
  onArchiveBox,
  onDeleteBox,
  onTriggerPhotoUpload,
  onTriggerReferencePhotoUpload,
  onOpenBoxLabel,
  onOpenQr,
  onOpenBarcode,
  onOpenAttachMaster,
  onOpenPhysicalLabel,
  onOpenTakePhotoLabel,
  onOpenRemoveExistingLabel,
  onSetRevokeIdentifierTarget,
  onSetPreviewImageUrl,
  onSetGalleryIndex,
  onSetImageToDelete,
  isEditing = false,
  isMoving = false,
  editName = '',
  editDesc = '',
  newLocationId = '',
  locations = [],
  onSetEditName,
  onSetEditDesc,
  onSetNewLocationId,
  onSaveEdit,
  onConfirmMove,
  onCancelEdit,
  onCancelMove,
}) => {
  const [activeTab, setActiveTab] = useState<'contents' | 'photos' | 'codes' | 'history'>('contents');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  return (
    <div className="mobile-box-detail" data-layout="mobile">
      {/* 1. Compact Mobile Header */}
      <div className="mobile-box-header">
        <div className="mobile-box-header__top">
          <div className="mobile-box-header__info">
            <span className="badge badge-boxid mobile-box-header__badge">{container.boxId}</span>
            <h1 className="mobile-box-header__title">{container.name || 'Unnamed Box'}</h1>
            <div className="mobile-box-header__subinfo">
              <span className="mobile-box-header__location">📍 {locationPathString}</span>
              {container.isPacked && (
                <span className="mobile-box-header__packed-badge">Packed</span>
              )}
            </div>
          </div>

          {/* Header Action Menu */}
          <div className="mobile-box-header__menu-wrapper" ref={menuRef}>
            <button
              type="button"
              aria-label="Box actions"
              className="btn btn-secondary btn--icon-md mobile-box-header__menu-trigger"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              ⋮
            </button>

            {isMenuOpen && (
              <div className="mobile-box-header__dropdown">
                <button
                  type="button"
                  onClick={() => { setIsMenuOpen(false); onEditBox(); }}
                  disabled={container.isArchived}
                >
                  ✏️ Edit Box
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMenuOpen(false); onMoveBox(); }}
                  disabled={container.isArchived}
                >
                  📦 Move Box
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMenuOpen(false); onArchiveBox(); }}
                >
                  📥 {container.isArchived ? 'Restore Box' : 'Archive Box'}
                </button>
                {container.isArchived && isOwner && (
                  <button
                    type="button"
                    className="mobile-dropdown-danger"
                    onClick={() => { setIsMenuOpen(false); onDeleteBox(); }}
                  >
                    🗑️ Delete Box
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {container.description && (
          <div className="mobile-box-header__desc">{container.description}</div>
        )}

        {/* Move Box Form (Mobile) */}
        {isMoving && (
          <form onSubmit={onConfirmMove} className="box-header-form mobile-header-form" style={{ marginTop: '0.75rem' }}>
            <div className="form-group box-header-form__group">
              <label className="box-header-form__label">Select New Storage Location</label>
              <select
                value={newLocationId}
                onChange={(e) => onSetNewLocationId?.(e.target.value)}
                className="box-header-form__select"
                required
              >
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="box-header-form__actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary btn--sm">Confirm Move</button>
              <button type="button" className="btn btn-secondary btn--sm" onClick={onCancelMove}>Cancel</button>
            </div>
          </form>
        )}

        {/* Edit Details Form (Mobile) */}
        {isEditing && (
          <form onSubmit={onSaveEdit} className="box-header-form mobile-header-form" style={{ marginTop: '0.75rem' }}>
            <div className="form-group box-header-form__group">
              <label className="box-header-form__label">Box Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => onSetEditName?.(e.target.value)}
                className="box-header-form__input"
                style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div className="form-group box-header-form__group" style={{ marginTop: '0.5rem' }}>
              <label className="box-header-form__label">Description</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => onSetEditDesc?.(e.target.value)}
                className="box-header-form__input"
                style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div className="box-header-form__actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn--sm">Save Details</button>
              <button type="button" className="btn btn-secondary btn--sm" onClick={onCancelEdit}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Compact Quick Summary Row */}
      <div className="mobile-summary-row" role="region" aria-label="Box summary counts">
        <button
          type="button"
          className={`mobile-summary-item ${activeTab === 'contents' ? 'mobile-summary-item--active' : ''}`}
          onClick={() => setActiveTab('contents')}
        >
          <span className="mobile-summary-count">{itemCount}</span>
          <span className="mobile-summary-label">{itemCount === 1 ? 'item' : 'items'}</span>
        </button>
        <button
          type="button"
          className={`mobile-summary-item ${activeTab === 'photos' ? 'mobile-summary-item--active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <span className="mobile-summary-count">{photoCount}</span>
          <span className="mobile-summary-label">{photoCount === 1 ? 'photo' : 'photos'}</span>
        </button>
        <button
          type="button"
          className={`mobile-summary-item ${activeTab === 'codes' ? 'mobile-summary-item--active' : ''}`}
          onClick={() => setActiveTab('codes')}
        >
          <span className="mobile-summary-count">{codeCount}</span>
          <span className="mobile-summary-label">{codeCount === 1 ? 'code' : 'codes'}</span>
        </button>
      </div>

      {/* 3. Mobile Section Navigation Tabs */}
      <nav className="mobile-tab-nav" aria-label="Box sections">
        <div className="mobile-tab-list" role="tablist">
          <button
            type="button"
            role="tab"
            id="tab-contents"
            aria-selected={activeTab === 'contents'}
            aria-controls="panel-contents"
            className={`mobile-tab-btn ${activeTab === 'contents' ? 'mobile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('contents')}
          >
            Contents
          </button>
          <button
            type="button"
            role="tab"
            id="tab-photos"
            aria-selected={activeTab === 'photos'}
            aria-controls="panel-photos"
            className={`mobile-tab-btn ${activeTab === 'photos' ? 'mobile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            Photos
          </button>
          <button
            type="button"
            role="tab"
            id="tab-codes"
            aria-selected={activeTab === 'codes'}
            aria-controls="panel-codes"
            className={`mobile-tab-btn ${activeTab === 'codes' ? 'mobile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('codes')}
          >
            Codes
          </button>
          <button
            type="button"
            role="tab"
            id="tab-history"
            aria-selected={activeTab === 'history'}
            aria-controls="panel-history"
            className={`mobile-tab-btn ${activeTab === 'history' ? 'mobile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>
      </nav>

      {/* 4. Single Active Section Panel */}
      <div className="mobile-active-panel">
        {activeTab === 'contents' && (
          <div id="panel-contents" role="tabpanel" aria-labelledby="tab-contents">
            <ItemList
              workspaceId={workspaceId}
              containerId={containerId}
              isContainerArchived={container.isArchived}
              onAddFromPhoto={onTriggerPhotoUpload}
            />
          </div>
        )}

        {activeTab === 'photos' && (
          <div id="panel-photos" role="tabpanel" aria-labelledby="tab-photos" className="mobile-section-card">
            <div className="mobile-section-header">
              <div>
                <h3 className="mobile-section-title">Photos</h3>
                <p className="mobile-section-subtitle">Reference photos of this box.</p>
              </div>
              {!container.isArchived && (
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  disabled={isUploadingReference}
                  onClick={onTriggerReferencePhotoUpload}
                >
                  {isUploadingReference ? 'Uploading...' : '+ Add Photo'}
                </button>
              )}
            </div>

            {referenceImages.length > 0 ? (
              <div className="mobile-photos-grid">
                {referenceImages.slice(0, 4).map((img, idx) => (
                  <div key={img.id} className="mobile-photo-thumb-wrapper">
                    <AuthenticatedImage
                      src={img.url}
                      alt="Box reference photo"
                      className="mobile-photo-thumb-img"
                      onClick={() => onSetGalleryIndex(idx)}
                    />
                    {!container.isArchived && (
                      <button
                        type="button"
                        onClick={() => onSetImageToDelete({ id: img.id, url: img.url })}
                        className="mobile-photo-delete-btn"
                        title="Delete reference photo"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mobile-section-empty">No reference photos added yet.</div>
            )}
          </div>
        )}

        {activeTab === 'codes' && (
          <div id="panel-codes" role="tabpanel" aria-labelledby="tab-codes" className="mobile-section-card">
            <div className="mobile-section-header">
              <h3 className="mobile-section-title">Labels & Codes</h3>
              <p className="mobile-section-subtitle">Ways to recognize or scan this box.</p>
            </div>

            {/* BOX ID */}
            <div className="mobile-code-boxid-row">
              <div>
                <span className="mobile-code-label">BOX ID</span>
                <div className="mobile-code-boxid-value">{container.boxId}</div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                disabled={container.isArchived}
                onClick={onOpenBoxLabel}
              >
                🏷️ Print Label
              </button>
            </div>

            {/* Existing Label */}
            {(container.physicalLabel || labelImage) && (
              <div className="mobile-code-section">
                <span className="mobile-code-label">EXISTING LABEL</span>
                {container.physicalLabel && (
                  <div className="mobile-existing-label-text">🏷️ {container.physicalLabel}</div>
                )}
                {labelImage && (
                  <div className="mobile-existing-label-photo">
                    <AuthenticatedImage
                      src={labelImage.url}
                      alt="Photographed label"
                      className="mobile-existing-thumb"
                      onClick={() => onSetPreviewImageUrl(labelImage.url)}
                    />
                    <span>Photographed label</span>
                  </div>
                )}
                {!container.isArchived && (
                  <div className="mobile-code-btn-row">
                    <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenPhysicalLabel}>
                      {container.physicalLabel ? 'Edit Text' : '+ Add Text'}
                    </button>
                    <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenTakePhotoLabel}>
                      {labelImage ? 'Replace Photo' : 'Add Photo'}
                    </button>
                    <button type="button" className="btn btn-danger btn--sm" onClick={onOpenRemoveExistingLabel}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scannable Codes */}
            <div className="mobile-code-section">
              <span className="mobile-code-label">SCANNABLE CODES</span>
              {identifiers.length > 0 ? (
                <div className="mobile-scannable-list">
                  {identifiers.map((ident) => (
                    <div key={ident.id} className="mobile-scannable-item">
                      <div className="mobile-scannable-info">
                        <span>{ident.type === 'QR' ? '📱' : '║▌'}</span>
                        <strong>{ident.type === 'QR' ? 'QR Code' : 'Barcode'}</strong>
                      </div>
                      {!container.isArchived && (
                        <div className="mobile-scannable-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn--sm"
                            onClick={() => ident.type === 'QR' ? onOpenQr() : onOpenBarcode()}
                          >
                            View / Print
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn--sm"
                            onClick={() => onSetRevokeIdentifierTarget({ id: ident.id, type: ident.type, value: ident.value })}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mobile-section-empty">No scannable codes generated.</div>
              )}

              {!container.isArchived && (
                <div className="mobile-code-gen-actions">
                  {!identifiers.some((i: any) => i.type === 'QR') && (
                    <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenQr}>
                      📱 + Generate QR Code
                    </button>
                  )}
                  {!identifiers.some((i: any) => i.type === 'BARCODE') && (
                    <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenBarcode}>
                      ║▌ + Generate Barcode
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenAttachMaster}>
                    + Add Existing Code or Label
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="mobile-history-wrapper">
            <BoxHistoryTimeline workspaceId={workspaceId} containerId={containerId} />
          </div>
        )}
      </div>
    </div>
  );
};
