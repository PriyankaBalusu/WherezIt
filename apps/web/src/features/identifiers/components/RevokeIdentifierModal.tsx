import React from 'react';
import { useRevokeIdentifier } from '../hooks/useIdentifiers';

interface RevokeIdentifierModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  identifierId: string | null;
  identifierType?: 'QR' | 'BARCODE';
  identifierValue?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const RevokeIdentifierModal: React.FC<RevokeIdentifierModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  identifierId,
  identifierType = 'QR',
  identifierValue = '',
  isOpen,
  onClose,
}) => {
  const revokeMutation = useRevokeIdentifier(workspaceId, containerId);

  if (!isOpen || !identifierId) return null;

  const handleConfirmRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(identifierId);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to remove identifier.');
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-identifier-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 id="revoke-identifier-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: '#dc2626', fontWeight: 700 }}>
          Remove this {identifierType === 'QR' ? 'QR code' : 'barcode'} from {boxDisplayId}?
        </h3>

        <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem', marginTop: 0 }}>
          Code value: <code style={{ backgroundColor: '#f1f5f9', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>{identifierValue}</code>
        </p>

        <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '0.75rem 1rem', borderRadius: '0.25rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#991b1b' }}>
          The code will no longer resolve to <strong>{boxDisplayId}</strong>.
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleConfirmRevoke}
            disabled={revokeMutation.isPending}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            {revokeMutation.isPending ? 'Removing...' : 'Remove Identifier'}
          </button>
        </div>
      </div>
    </div>
  );
};
