import React, { useState, useEffect } from 'react';
import { useUpdateContainer } from '../../containers/hooks/useContainers';

interface PhysicalLabelModalProps {
  workspaceId: string;
  containerId: string;
  currentPhysicalLabel?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PhysicalLabelModal: React.FC<PhysicalLabelModalProps> = ({
  workspaceId,
  containerId,
  currentPhysicalLabel,
  isOpen,
  onClose,
}) => {
  const [label, setLabel] = useState(currentPhysicalLabel || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateContainer(workspaceId);

  useEffect(() => {
    setLabel(currentPhysicalLabel || '');
    setErrorMessage(null);
  }, [currentPhysicalLabel, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (trimmed.length > 100) {
      setErrorMessage('Physical label cannot exceed 100 characters.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        containerId,
        data: {
          physicalLabel: trimmed || '',
        },
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save physical label.');
    }
  };

  const handleSelectExample = (example: string) => {
    setLabel(example);
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="physical-label-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="physical-label-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Physical Label
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
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="physical-label-input" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Enter what's written on the physical box
            </label>
            <input
              id="physical-label-input"
              type="text"
              placeholder="e.g. Christmas Box, Blue Tote, Kitchen #2"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.95rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              Enter handwritten notes, chalk markings, or sticker text visible on the box.
            </span>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Common Examples
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['Christmas Box', 'Blue Tote', 'Kitchen #2', 'Kids Winter Clothes', 'XMAS DECOR'].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => handleSelectExample(ex)}
                  style={{
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '1rem',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  + {ex}
                </button>
              ))}
            </div>
          </div>

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
              disabled={updateMutation.isPending}
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Label'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
