import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { acquireContainerBarcodeIdentifier, BarcodeIdentifierResponse } from '../api/barcodeApi';
import { useContainerIdentifiers } from '../hooks/useIdentifiers';
import { useQueryClient } from '@tanstack/react-query';

interface PrintBarcodeLabelModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintBarcodeLabelModal: React.FC<PrintBarcodeLabelModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { data: identifiers } = useContainerIdentifiers(workspaceId, containerId);
  const [identifier, setIdentifier] = useState<BarcodeIdentifierResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen && identifiers && !identifier) {
      const activeBarcode = identifiers.find(i => i.type === 'BARCODE');
      if (activeBarcode) {
        setIdentifier({
          identifierId: activeBarcode.id,
          value: activeBarcode.value,
          type: 'BARCODE',
          createdAt: activeBarcode.createdAt || new Date().toISOString()
        });
      }
    }
  }, [isOpen, identifiers, identifier, workspaceId, containerId]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await acquireContainerBarcodeIdentifier(workspaceId, containerId);
      setIdentifier(data);
      queryClient.invalidateQueries({ queryKey: ['containerIdentifiers', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to acquire barcode');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (identifier && svgRef.current) {
      try {
        JsBarcode(svgRef.current, identifier.value, {
          format: 'CODE128',
          displayValue: false,
          margin: 10,
          height: 50,
        });
      } catch (err) {
        console.error('JsBarcode rendering error:', err);
      }
    }
  }, [identifier]);

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
      className="barcode-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .barcode-label-printable, .barcode-label-printable * {
            visibility: visible;
          }
          .barcode-label-printable {
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
          .barcode-modal-backdrop {
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
          <h3 id="barcode-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
            Barcode Label
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

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            Generating barcode label...
          </div>
        )}

        {error && (
          <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {!identifier && !isLoading && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              No barcode has been created for this box.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
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
                onClick={handleGenerate}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                Generate Barcode
              </button>
            </div>
          </div>
        )}

        {identifier && (
          <div style={{ textAlign: 'center' }}>
            {/* Printable Barcode Card */}
            <div
              className="barcode-label-printable"
              style={{
                border: '2px solid #2d3748',
                borderRadius: '0.5rem',
                padding: '1.25rem 1rem',
                backgroundColor: '#fff',
                margin: '0 auto 1.5rem auto',
                maxWidth: '300px',
                width: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                <img src="/icons/icon-192.svg" alt="WherezIt Logo" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase' }}>
                  WHEREZIT
                </span>
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {boxDisplayId}
              </div>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden', marginBottom: '0.25rem' }}>
                <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
              </div>

              <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569', marginTop: '0.25rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {identifier.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Scan to find this box
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }} className="no-print">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-danger btn--md"
                onClick={handleRevoke}
                disabled={!identifier}
              >
                Revoke Label
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                onClick={() => window.print()}
                disabled={!identifier}
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
