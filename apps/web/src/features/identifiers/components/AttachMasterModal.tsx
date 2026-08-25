import React from 'react';

interface AttachMasterModalProps {
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'SCAN' | 'LABEL' | 'PHOTO') => void;
}

export const AttachMasterModal: React.FC<AttachMasterModalProps> = ({
  boxDisplayId,
  isOpen,
  onClose,
  onSelectOption,
}) => {
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
      aria-labelledby="attach-master-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="attach-master-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Attach Existing Identifier
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#475569', marginTop: 0, marginBottom: '1.5rem', lineHeight: 1.5 }}>
          What is already on <strong>{boxDisplayId}</strong>? Use existing text, stickers, QR codes, or barcodes to easily identify this container.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <button
            type="button"
            onClick={() => onSelectOption('SCAN')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '0.625rem',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <span style={{ fontSize: '1.75rem' }}>📷</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Scan QR / Barcode</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Scan a QR code or barcode sticker already printed on the box</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectOption('LABEL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '0.625rem',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <span style={{ fontSize: '1.75rem' }}>🏷️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Enter Physical Label</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Type handwritten text or alias written on the box (e.g. 'Christmas Box')</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectOption('PHOTO')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '0.625rem',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <span style={{ fontSize: '1.75rem' }}>🖼️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Take Photo of Label</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Snap a photo to extract text automatically with AI assistance</div>
            </div>
          </button>
        </div>

        <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
