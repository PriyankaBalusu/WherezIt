import React, { useState } from 'react';
import { useAttachIdentifier } from '../hooks/useIdentifiers';

interface AttachCodeModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'QR' | 'BARCODE';
}

export const AttachCodeModal: React.FC<AttachCodeModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  isOpen,
  onClose,
  initialType = 'QR',
}) => {
  const [codeValue, setCodeValue] = useState('');
  const [codeType, setCodeType] = useState<'QR' | 'BARCODE'>(initialType);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attachMutation = useAttachIdentifier(workspaceId, containerId);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSimulateScan = () => {
    // Helper to simulate scanning from camera in browser
    const simulated = codeType === 'QR' ? 'QR-BOX-9988' : 'BAR-7711-22';
    setCodeValue(simulated);
    setIsScanning(false);
  };

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
      aria-labelledby="attach-code-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="attach-code-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Attach {codeType === 'QR' ? 'QR Code' : 'Barcode'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}
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
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <button
              type="button"
              className={codeType === 'QR' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setCodeType('QR')}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
            >
              QR Code
            </button>
            <button
              type="button"
              className={codeType === 'BARCODE' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setCodeType('BARCODE')}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
            >
              Barcode
            </button>
          </div>

          {isScanning ? (
            <div
              style={{
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                padding: '2rem 1rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>
                Position code within camera frame...
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSimulateScan}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Simulate Detected Code
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsScanning(false)}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', color: '#cbd5e1', borderColor: '#334155' }}
                >
                  Cancel Camera
                </button>
              </div>
            </div>
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="code-value-input" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Code Value
            </label>
            <input
              id="code-value-input"
              type="text"
              placeholder="e.g. ABC-123-XYZ or UPC 0123456789"
              value={codeValue}
              onChange={(e) => {
                setCodeValue(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              required
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.9rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              Enter or scan the exact encoded string printed on the physical code.
            </span>
          </div>

          {codeValue.trim() && (
            <div
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                color: '#0369a1',
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
              disabled={attachMutation.isPending || !codeValue.trim()}
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
