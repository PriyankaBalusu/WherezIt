import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceContext } from '../../workspaces/context/WorkspaceContext';
import { CodeScanner } from './CodeScanner';
import { ResolvedContainerResponse } from '../api/identifierApi';

export const GlobalScanScreen: React.FC = () => {
  const navigate = useNavigate();
  const workspaceContext = useWorkspaceContext();

  const handleResolve = (result: ResolvedContainerResponse) => {
    if (result.containerId && result.workspaceId) {
      if (workspaceContext && workspaceContext.activeWorkspace?.id !== result.workspaceId) {
        workspaceContext.setActiveWorkspaceId(result.workspaceId);
      }
      navigate(`/workspaces/${result.workspaceId}/containers/${result.containerId}`);
    }
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
          Scan a WherezIt QR code or barcode to find its box instantly.
        </p>
      </div>

      <CodeScanner onResolve={handleResolve} />
    </div>
  );
};
export default GlobalScanScreen;
