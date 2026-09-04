import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PrintBoxLabelModalProps {
  boxDisplayId: string;
  boxName?: string;
  locationPath?: string;
  isOpen: boolean;
  onClose: () => void;
}

function getPrintRoot(): HTMLElement {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  return root;
}

export const PrintBoxLabelModal: React.FC<PrintBoxLabelModalProps> = ({
  boxDisplayId,
  boxName,
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

  const modalContent = (
    <div
      className="container-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="box-label-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="container-modal-surface container-modal-surface--md"
        style={{
          padding: '1.75rem 1.75rem 1.5rem',
        }}
      >
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h3
            id="box-label-modal-title"
            className="container-modal-title"
            style={{ margin: 0 }}
          >
            WherezIt Box Label
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              lineHeight: 1,
              padding: 0,
            }}
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
            width: '100%',
            maxWidth: '320px',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              marginBottom: '0.75rem',
            }}
          >
            <img
              src="/icons/icon-192.svg"
              alt="WherezIt Logo"
              style={{ width: '20px', height: '20px', borderRadius: '4px' }}
            />
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: '#64748b',
                textTransform: 'uppercase',
              }}
            >
              WHEREZIT
            </span>
          </div>

          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              marginBottom: '0.5rem',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {boxDisplayId}
          </div>

          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#1e293b',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {boxName || 'Unnamed Box'}
          </div>
        </div>

        <div
          className="container-modal-actions no-print"
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: 0,
            borderTop: 'none',
            backgroundColor: 'transparent',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn--md"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn--md"
            onClick={() => window.print()}
          >
            Print Label
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, getPrintRoot());
};

