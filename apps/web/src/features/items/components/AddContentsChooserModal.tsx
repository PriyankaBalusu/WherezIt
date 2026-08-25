import React, { useEffect } from 'react';

interface AddContentsChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onSelectPhoto: () => void;
}

export const AddContentsChooserModal: React.FC<AddContentsChooserModalProps> = ({
  isOpen,
  onClose,
  onSelectManual,
  onSelectPhoto,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
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
      aria-labelledby="add-contents-chooser-title"
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 id="add-contents-chooser-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
            Add contents
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', marginTop: 0 }}>
          How would you like to add items?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Add Manually option */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectManual();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
              Add Manually
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Enter item name, category and quantity.
            </span>
          </button>

          {/* Add from Photo option */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectPhoto();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
              Add from Photo
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Upload a photo and let AI suggest items for your review.
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
