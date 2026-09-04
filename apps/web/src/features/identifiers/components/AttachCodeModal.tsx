import React, { useState } from 'react';
import { useAttachIdentifier } from '../hooks/useIdentifiers';
import { CodeScanner } from './CodeScanner';

interface AttachCodeModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'QR' | 'BARCODE';
  hasActiveQr?: boolean;
  hasActiveBarcode?: boolean;
}

export const AttachCodeModal: React.FC<AttachCodeModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  isOpen,
  onClose,
  initialType = 'QR',
  hasActiveQr = false,
  hasActiveBarcode = false,
}) => {
  const [codeValue, setCodeValue] = useState('');
  const [codeType, setCodeType] = useState<'QR' | 'BARCODE'>(() => {
    if (hasActiveQr && !hasActiveBarcode) return 'BARCODE';
    if (hasActiveBarcode && !hasActiveQr) return 'QR';
    return initialType;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attachMutation = useAttachIdentifier(workspaceId, containerId);

  if (!isOpen) return null;

  const bothBlocked = hasActiveQr && hasActiveBarcode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((codeType === 'QR' && hasActiveQr) || (codeType === 'BARCODE' && hasActiveBarcode)) {
      const typeStr = codeType === 'QR' ? 'QR code' : 'barcode';
      setErrorMessage(`This box already has an active ${typeStr}. Revoke it before adding another ${typeStr}.`);
      return;
    }

    const trimmed = codeValue.trim();
    if (!trimmed) {
      setErrorMessage('Please enter or scan a valid code value.');
      return;
    }

    setErrorMessage(null);
    try {
      await attachMutation.mutateAsync({ type: codeType, value: trimmed });
      setCodeValue('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to attach identifier.');
    }
  };

  const handleRawCodeScanned = (value: string, format?: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const isScannedQr = format === 'qr_code';
    const isScannedBarcode = format && ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'zxing_barcode'].includes(format);

    if (isScannedQr && hasActiveQr) {
      setIsScanning(false);
      setErrorMessage('This box already has an active QR code. Revoke it before adding another QR code.');
      return;
    }

    if (isScannedBarcode && hasActiveBarcode) {
      setIsScanning(false);
      setErrorMessage('This box already has an active barcode. Revoke it before adding another barcode.');
      return;
    }

    setCodeValue(trimmed);

    if (isScannedQr) {
      setCodeType('QR');
    } else if (isScannedBarcode) {
      setCodeType('BARCODE');
    }

    setIsScanning(false);
    if (errorMessage) setErrorMessage(null);
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
      aria-labelledby="attach-code-modal-title"
    >
      <div
        className="attach-code-modal-dialog modal-surface"
        style={{
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '480px',
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          boxShadow: 'var(--color-card-shadow, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="attach-code-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
            Attach {codeType === 'QR' ? 'QR Code' : 'Barcode'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderLeft: '4px solid #ef4444',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {bothBlocked ? (
            <div
              role="alert"
              style={{
                backgroundColor: 'var(--color-surface-raised, #f8fafc)',
                border: '1px solid var(--color-border, #cbd5e1)',
                color: 'var(--color-text-muted, #64748b)',
                padding: '0.875rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              This box already has an active QR code and barcode. Revoke one before attaching another code.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  disabled={hasActiveQr}
                  className={codeType === 'QR' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setCodeType('QR')}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', opacity: hasActiveQr ? 0.5 : 1, cursor: hasActiveQr ? 'not-allowed' : 'pointer' }}
                >
                  QR Code {hasActiveQr ? '(Active)' : ''}
                </button>
                <button
                  type="button"
                  disabled={hasActiveBarcode}
                  className={codeType === 'BARCODE' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setCodeType('BARCODE')}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', opacity: hasActiveBarcode ? 0.5 : 1, cursor: hasActiveBarcode ? 'not-allowed' : 'pointer' }}
                >
                  Barcode {hasActiveBarcode ? '(Active)' : ''}
                </button>
              </div>

              {hasActiveQr && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '-0.75rem' }}>
                  This box already has an active QR code. Revoke it before attaching another.
                </div>
              )}
              {hasActiveBarcode && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '-0.75rem' }}>
                  This box already has an active barcode. Revoke it before attaching another.
                </div>
              )}

              {isScanning ? (
                <CodeScanner
                  autoStart
                  hideManualInput
                  scanMode="ALL"
                  expectedFormats={['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39']}
                  onScanRaw={handleRawCodeScanned}
                  onCancel={() => setIsScanning(false)}
                />
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsScanning(true)}
                  style={{ width: '100%', padding: '0.625rem', fontSize: '0.875rem' }}
                >
                  📷 Open Camera Scanner
                </button>
              )}
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="code-value-input" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Code Value
            </label>
            <input
              id="code-value-input"
              type="text"
              placeholder="e.g. ABC-123-XYZ or UPC 0123456789"
              value={codeValue}
              disabled={bothBlocked}
              onChange={(e) => {
                setCodeValue(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              required
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.9rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.25rem', display: 'block' }}>
              Enter or scan the exact encoded string printed on the physical code.
            </span>
          </div>

          {codeValue.trim() && !bothBlocked && (
            <div
              style={{
                backgroundColor: 'var(--color-surface-raised, #f0f9ff)',
                border: '1px solid var(--color-border, #bae6fd)',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                color: 'var(--color-text, #0369a1)',
              }}
            >
              Attach this {codeType === 'QR' ? 'QR code' : 'barcode'} <strong>({codeValue.trim()})</strong> to{' '}
              <strong>{boxDisplayId}</strong>?
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={attachMutation.isPending || !codeValue.trim() || bothBlocked}
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}
            >
              {attachMutation.isPending ? 'Attaching...' : 'Attach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

