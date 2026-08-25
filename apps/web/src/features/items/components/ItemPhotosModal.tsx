import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { compressImage } from '../../images/utils/compressImage';

interface ItemPhotosModalProps {
  workspaceId: string;
  itemId: string;
  itemName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ItemImageItem {
  id: string;
  url: string;
  createdAt: string;
}

export const ItemPhotosModal: React.FC<ItemPhotosModalProps> = ({
  workspaceId,
  itemId,
  itemName,
  isOpen,
  onClose,
}) => {
  const { getIdToken } = useAuth();
  const [images, setImages] = useState<ItemImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ItemImageItem | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getIdToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(itemId)}/images`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch {
      setError('Failed to load item photos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, workspaceId, itemId]);

  if (!isOpen) return null;

  const handleUploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed.file);

      const token = await getIdToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(itemId)}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload item photo.');
      }

      await fetchImages();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDeleteImage = async () => {
    if (!imageToDelete) return;
    try {
      setError(null);
      const token = await getIdToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(itemId)}/images/${encodeURIComponent(imageToDelete.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to delete photo.');
      }

      setImageToDelete(null);
      await fetchImages();
    } catch (err: any) {
      setError(err.message || 'Failed to remove photo.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1500,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-photos-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '540px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ITEM PHOTOS
            </span>
            <h2 id="item-photos-modal-title" style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              {itemName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {error && (
          <div role="alert" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Photo Gallery Grid */}
        <div style={{ marginBottom: '1.5rem' }}>
          {isLoading ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Loading photos...</div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
              <div style={{ fontWeight: 600, color: '#334155' }}>No photos added yet</div>
              <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0 0', color: '#64748b' }}>Add clear photos of this item for quick visual identification.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
              {images.map((img) => (
                <div
                  key={img.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#0f172a',
                  }}
                >
                  <img
                    src={img.url}
                    alt={itemName}
                    onClick={() => setSelectedFullImage(img.url)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageToDelete(img)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(239, 68, 68, 0.9)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    title="Remove Photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={isUploading}
              onClick={() => cameraInputRef.current?.click()}
              style={{ padding: '0.5rem 0.875rem', fontSize: '0.85rem' }}
            >
              📷 Take Photo
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={isUploading}
              onClick={() => libraryInputRef.current?.click()}
              style={{ padding: '0.5rem 0.875rem', fontSize: '0.85rem' }}
            >
              📁 Choose File
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Full Image Viewer */}
      {selectedFullImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '1rem',
          }}
          onClick={() => setSelectedFullImage(null)}
        >
          <img
            src={selectedFullImage}
            alt={itemName}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '0.5rem', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Confirm Remove Photo Modal */}
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
            zIndex: 2500,
            padding: '1rem',
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626', fontSize: '1.1rem' }}>Remove Photo?</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 1.25rem 0' }}>
              Are you sure you want to remove this photo from {itemName}?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setImageToDelete(null)} style={{ padding: '0.4rem 0.875rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={handleDeleteImage} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                Remove Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
