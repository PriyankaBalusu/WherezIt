import React, { useEffect } from 'react';

interface PrintBoxLabelModalProps {
  boxDisplayId: string;
  boxName: string;
  locationPath: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintBoxLabelModal: React.FC<PrintBoxLabelModalProps> = ({
  boxDisplayId,
  boxName,
  locationPath,
  isOpen,
  onClose,
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
      className="box-label-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="box-label-modal-title"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .box-label-printable, .box-label-printable * {
            visibility: visible;
          }
          .box-label-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: flex !important;
            justify-content: center;
            align-items: center;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
          .box-label-modal-backdrop {
            background: transparent !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }} className="no-print">
          <h3 id="box-label-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
            WherezIt Box Label
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

        {/* Printable Label Card */}
        <div
          className="box-label-printable"
          style={{
            border: '2px solid #0f172a',
            borderRadius: '0.5rem',
            padding: '1.75rem 1.5rem',
            backgroundColor: '#fff',
            margin: '0 auto 1.5rem auto',
            maxWidth: '320px',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
            <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase' }}>
              WHEREZIT
            </span>
          </div>

          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '0.5rem', maxWidth: '100%', wordBreak: 'break-word' }}>
            {boxDisplayId}
          </div>

          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', maxWidth: '100%', wordBreak: 'break-word' }}>
            {boxName || 'Unnamed Box'}
          </div>

          {locationPath && (
            <div style={{ fontSize: '0.85rem', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem', marginTop: '0.5rem', maxWidth: '100%', wordBreak: 'break-word' }}>
              📍 {locationPath}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }} className="no-print">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            Print Label
          </button>
        </div>
      </div>
    </div>
  );
};
