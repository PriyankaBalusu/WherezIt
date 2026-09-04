import React, { useState, useEffect, useRef } from 'react';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; category?: string; quantity: number; photoFile?: File | null }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCategory('');
      setQuantity(1);
      setSelectedPhotoFile(null);
      setPhotoPreviewUrl(null);
      setFormError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
    onClose();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      setSelectedPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedCat = category.trim();

    if (!trimmedName) {
      setFormError('Item name cannot be empty.');
      return;
    }

    if (trimmedName.length > 100) {
      setFormError('Item name must be 100 characters or fewer.');
      return;
    }

    if (trimmedCat.length > 50) {
      setFormError('Category must be 50 characters or fewer.');
      return;
    }

    if (quantity < 1) {
      setFormError('Quantity must be 1 or greater.');
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        category: trimmedCat ? trimmedCat : undefined,
        quantity,
        photoFile: selectedPhotoFile,
      });
      handleClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add item.');
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
        backgroundColor: 'var(--color-modal-overlay, rgba(0, 0, 0, 0.5))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-item-modal-title"
    >
      {/* Hidden File Inputs for Camera & Photo Library */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handlePhotoSelect}
        style={{ display: 'none' }}
        aria-label="Take photo with camera"
      />
      <input
        type="file"
        accept="image/*"
        ref={libraryInputRef}
        onChange={handlePhotoSelect}
        style={{ display: 'none' }}
        aria-label="Choose existing photo"
      />

      <div
        className="add-item-modal-dialog modal-surface"
        style={{
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '440px',
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 id="add-item-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
            Add Item to Box
          </h3>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {formError && (
          <div role="alert" style={{ backgroundColor: 'var(--color-danger-bg, #fef2f2)', color: 'var(--color-danger, #991b1b)', borderLeft: '4px solid var(--color-danger, #ef4444)', padding: '0.625rem 0.875rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem', display: 'block' }}>
              Item Name *
            </label>
            <input
              type="text"
              maxLength={100}
              placeholder="e.g. Christmas Lights"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem', display: 'block' }}>
              Category
            </label>
            <input
              type="text"
              maxLength={50}
              placeholder="e.g. Holiday Decor"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem', display: 'block' }}>
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setQuantity(isNaN(val) ? 0 : val);
              }}
              disabled={isSubmitting}
              style={{ width: '100px', padding: '0.625rem', borderRadius: '0.375rem', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Optional Item Photo Section */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #334155)', marginBottom: '0.375rem', display: 'block' }}>
              Item Photo <span style={{ color: 'var(--color-text-muted, #64748b)', fontWeight: 400 }}>(optional)</span>
            </label>

            {selectedPhotoFile && photoPreviewUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', border: '1px solid var(--color-border-strong, #cbd5e1)', borderRadius: '0.375rem', backgroundColor: 'var(--color-surface-raised, #f8fafc)' }}>
                <img
                  src={photoPreviewUrl}
                  alt="Item photo preview"
                  style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '0.25rem', border: '1px solid var(--color-border-strong, #cbd5e1)' }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text, #0f172a)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedPhotoFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isSubmitting}
                    style={{ background: 'none', border: 'none', color: 'var(--color-danger, #dc2626)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', fontWeight: 600, marginTop: '0.2rem' }}
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                >
                  📷 Take Photo
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  onClick={() => libraryInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                >
                  📁 Choose Existing Photo
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn--md"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn--md"
            >
              {isSubmitting ? 'Adding Item...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
