import React from 'react';

export const WorkspaceLoadingState: React.FC = () => {
  return (
    <div className="workspace-loading-container" style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="spinner" style={{ fontSize: '1.2rem', color: '#666' }}>
        Loading your workspaces...
      </div>
    </div>
  );
};
