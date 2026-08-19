import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { acquireContainerQrIdentifier, QrIdentifierResponse } from '../api/identifierApi';

interface PrintQrLabelModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  onClose: () => void;
}

export const PrintQrLabelModal: React.FC<PrintQrLabelModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  onClose,
}) => {
  const [identifier, setIdentifier] = useState<QrIdentifierResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadIdentifier() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await acquireContainerQrIdentifier(workspaceId, containerId);
        if (isMounted) {
          setIdentifier(res);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to generate QR label.');
          setIsLoading(false);
        }
      }
    }

    loadIdentifier();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, containerId]);

  const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
  const qrTargetUrl = identifier ? `${baseUrl}/scan/${encodeURIComponent(identifier.value)}` : '';

  const handlePrint = () => {
    window.print();
  };

  const handleRevoke = async () => {
    if (!identifier) return;
    const confirmed = window.confirm('Revoke this label? Existing printed/scanned copies will stop working.');
    if (!confirmed) return;

    try {
      const { revokeIdentifier } = await import('../api/identifierApi');
      await revokeIdentifier(workspaceId, identifier.identifierId);
      setIdentifier(null);
      setError('Label revoked successfully. Close or re-open to acquire a new active label.');
    } catch (err: any) {
      setError(err.message || 'Failed to revoke identifier.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      className="qr-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .qr-label-printable, .qr-label-printable * {
            visibility: visible;
          }
          .qr-label-printable {
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
          .qr-modal-backdrop {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }} className="no-print">
          <h3 id="qr-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1a202c' }}>Print QR Container Label</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#a0aec0' }}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            Retrieving QR identifier...
          </div>
        )}

        {error && (
          <div role="alert" style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {identifier && (
          <div style={{ textAlign: 'center' }}>
            {/* Printable Label Outer Card */}
            <div
              className="qr-label-printable"
              style={{
                border: '2px solid #2d3748',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                backgroundColor: '#fff',
                margin: '0 auto 1.5rem auto',
                maxWidth: '280px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.1em', color: '#4a5568', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                WHEREZIT
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a202c', marginBottom: '1rem' }}>
                {boxDisplayId}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <QRCodeSVG value={qrTargetUrl} size={160} level="M" />
              </div>

              <div style={{ fontSize: '0.85rem', color: '#718096', fontWeight: 600 }}>
                Scan to find this box
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }} className="no-print">
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e0', borderRadius: '0.25rem', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                style={{ padding: '0.5rem 1rem', border: '1px solid #e53e3e', color: '#e53e3e', borderRadius: '0.25rem', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 500 }}
              >
                Revoke Label
              </button>
              <button
                type="button"
                onClick={handlePrint}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '0.25rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Print Label
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
