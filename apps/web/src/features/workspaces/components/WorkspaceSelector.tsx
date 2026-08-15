import React from 'react';
import { Workspace } from '../types/workspace';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
}) => {
  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="workspace-selector" style={{ display: 'inline-block', marginRight: '1rem' }}>
      <label htmlFor="workspaceSelect" style={{ marginRight: '0.5rem', fontSize: '0.9rem', color: '#555' }}>
        Workspace:
      </label>
      <select
        id="workspaceSelect"
        value={activeWorkspaceId}
        onChange={(e) => onSelectWorkspace(e.target.value)}
        style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name} ({ws.role})
          </option>
        ))}
      </select>
    </div>
  );
};
