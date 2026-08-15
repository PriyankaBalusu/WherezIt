import React from 'react';

interface WorkspaceErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

export const WorkspaceErrorState: React.FC<WorkspaceErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="workspace-error-container" style={{ padding: '2rem', textAlign: 'center', color: '#c0392b' }}>
      <h2>Unable to Load Workspaces</h2>
      <p>{error?.message || 'An unexpected error occurred while loading your workspace data.'}</p>
      <button
        className="btn-primary"
        onClick={onRetry}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
      >
        Retry
      </button>
    </div>
  );
};
