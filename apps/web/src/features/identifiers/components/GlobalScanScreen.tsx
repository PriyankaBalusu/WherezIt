import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveContainerIdentifier } from '../api/identifierApi';
import { useWorkspaceContext } from '../../workspaces/context/WorkspaceContext';

export const GlobalScanScreen: React.FC = () => {
  const navigate = useNavigate();
  const workspaceContext = useWorkspaceContext();
  const activeWorkspace = workspaceContext?.activeWorkspace;

  const [codeValue, setCodeValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unassignedCode, setUnassignedCode] = useState<string | null>(null);

  const handleResolveCode = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Please enter or scan a valid code.');
      return;
    }

    setError(null);
    setUnassignedCode(null);
    setIsResolving(true);

    try {
      const result = await resolveContainerIdentifier(trimmed);
      setIsResolving(false);
      if (result.containerId && result.workspaceId) {
        navigate(`/workspaces/${result.workspaceId}/containers/${result.containerId}`);
      }
    } catch {
      setIsResolving(false);
      // Check if unassigned versus unauthorized/invalid (sanitized non-disclosure response)
      setUnassignedCode(trimmed);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleResolveCode(codeValue);
  };

  const handleSimulateScan = () => {
    const sampleCode = 'wzi_qr_demo_scan_123';
    setCodeValue(sampleCode);
    setIsScanning(false);
    handleResolveCode(sampleCode);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          GLOBAL SCAN
        </span>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: '#0f172a' }}>
          Scan a Code
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Scan any WherezIt QR code, barcode, or physical label to locate its box instantly.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {unassignedCode && (
        <div style={{ backgroundColor: '#fffbebfb', border: '1px solid #fde68a', padding: '1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, color: '#b45309', fontSize: '1rem', marginBottom: '0.25rem' }}>
            Code Not Linked to an Active Box
          </div>
          <p style={{ fontSize: '0.875rem', color: '#78350f', margin: '0 0 1rem 0' }}>
            The code <code>{unassignedCode}</code> is not linked to a container in this storage space, or is unassigned.
          </p>
          {activeWorkspace && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/workspaces/${activeWorkspace.id}`)}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              Browse Storage Space to Attach
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        {isScanning ? (
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '2.5rem 1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📷</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              Position QR or Barcode within camera frame
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Camera scanning active...
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSimulateScan}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Simulate Detected Code
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsScanning(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#f8fafc', borderColor: '#475569' }}
              >
                Close Camera
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsScanning(true)}
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', justifyContent: 'center' }}
          >
            📷 Open Camera Scanner
          </button>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="global-scan-input" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Enter Code Manually
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
              <input
                id="global-scan-input"
                type="text"
                placeholder="e.g. wzi_qr_... or ABC-123-XYZ"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                style={{ flex: 1, padding: '0.625rem', fontSize: '0.95rem' }}
              />
              <button
                type="submit"
                className="btn-secondary"
                disabled={isResolving || !codeValue.trim()}
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.9rem' }}
              >
                {isResolving ? 'Searching...' : 'Find Box'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
