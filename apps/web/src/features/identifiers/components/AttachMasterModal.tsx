import React, { useState, useEffect } from 'react';

interface AttachMasterModalProps {
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'SCAN' | 'LABEL' | 'PHOTO') => void;
  hasActiveQr?: boolean;
  hasActiveBarcode?: boolean;
  hasActivePhysicalLabel?: boolean;
}

export const AttachMasterModal: React.FC<AttachMasterModalProps> = ({
  boxDisplayId,
  isOpen,
  onClose,
  onSelectOption,
  hasActiveQr = false,
  hasActiveBarcode = false,
  hasActivePhysicalLabel = false,
}) => {
  const [step, setStep] = useState<'TOP' | 'LABEL_CHOOSER'>('TOP');

  useEffect(() => {
    if (isOpen) setStep('TOP');
  }, [isOpen]);

  if (!isOpen) return null;

  const allCodesBlocked = hasActiveQr && hasActiveBarcode;

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
      aria-labelledby="attach-master-modal-title"
    >
      <div
        className="attach-master-modal-dialog modal-surface"
        style={{
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '480px',
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          boxShadow: 'var(--color-card-shadow, 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04))',
        }}
      >
        {step === 'TOP' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 id="attach-master-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                Add Existing Code or Label
              </h2>
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted, #475569)', marginTop: 0, marginBottom: '1.5rem', lineHeight: 1.5 }}>
              What is already on <strong>{boxDisplayId}</strong>?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <button
                type="button"
                disabled={allCodesBlocked}
                onClick={() => onSelectOption('SCAN')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--color-surface-raised, #f8fafc)',
                  border: '1.5px solid var(--color-border-strong, #e2e8f0)',
                  borderRadius: '0.625rem',
                  textAlign: 'left',
                  cursor: allCodesBlocked ? 'not-allowed' : 'pointer',
                  opacity: allCodesBlocked ? 0.6 : 1,
                  transition: 'all 0.15s ease-in-out',
                }}
                onMouseOver={(e) => {
                  if (!allCodesBlocked) e.currentTarget.style.borderColor = 'var(--color-primary, #0284c7)';
                }}
                onMouseOut={(e) => {
                  if (!allCodesBlocked) e.currentTarget.style.borderColor = 'var(--color-border-strong, #e2e8f0)';
                }}
              >
                <span style={{ fontSize: '1.75rem' }}>📷</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text, #0f172a)' }}>Scan Existing QR / Barcode</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                    {allCodesBlocked
                      ? 'This box already has an active QR code and barcode. Revoke one before attaching another code.'
                      : 'Use a QR code or barcode sticker already on the box.'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={hasActivePhysicalLabel}
                onClick={() => setStep('LABEL_CHOOSER')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--color-surface-raised, #f8fafc)',
                  border: '1.5px solid var(--color-border-strong, #e2e8f0)',
                  borderRadius: '0.625rem',
                  textAlign: 'left',
                  cursor: hasActivePhysicalLabel ? 'not-allowed' : 'pointer',
                  opacity: hasActivePhysicalLabel ? 0.6 : 1,
                  transition: 'all 0.15s ease-in-out',
                }}
                onMouseOver={(e) => {
                  if (!hasActivePhysicalLabel) e.currentTarget.style.borderColor = 'var(--color-primary, #0284c7)';
                }}
                onMouseOut={(e) => {
                  if (!hasActivePhysicalLabel) e.currentTarget.style.borderColor = 'var(--color-border-strong, #e2e8f0)';
                }}
              >
                <span style={{ fontSize: '1.75rem' }}>🏷️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text, #0f172a)' }}>Add Existing Label</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                    {hasActivePhysicalLabel
                      ? 'This box already has an active physical label. Remove it before adding another.'
                      : 'Record a handwritten, printed, or photographed label already on the box.'}
                  </div>
                </div>
              </button>
            </div>

            <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 id="attach-master-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                Add Existing Label
              </h2>
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted, #475569)', marginTop: 0, marginBottom: '1.5rem', lineHeight: 1.5 }}>
              How would you like to record this label?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <button
                type="button"
                onClick={() => onSelectOption('LABEL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--color-surface-raised, #f8fafc)',
                  border: '1.5px solid var(--color-border-strong, #e2e8f0)',
                  borderRadius: '0.625rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary, #0284c7)')}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong, #e2e8f0)')}
              >
                <span style={{ fontSize: '1.75rem' }}>✏️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text, #0f172a)' }}>Enter Label Text</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>Record handwritten or printed text already on the box.</div>
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
                  backgroundColor: 'var(--color-surface-raised, #f8fafc)',
                  border: '1.5px solid var(--color-border-strong, #e2e8f0)',
                  borderRadius: '0.625rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary, #0284c7)')}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong, #e2e8f0)')}
              >
                <span style={{ fontSize: '1.75rem' }}>📷</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text, #0f172a)' }}>Take / Choose Label Photo</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>Capture or upload a photo of the existing label.</div>
                </div>
              </button>
            </div>

            <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setStep('TOP')}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
