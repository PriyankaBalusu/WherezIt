import React from 'react';
import { Workspace } from '../types/workspace';
import { StorageLocationList } from '../../locations/components/StorageLocationList';

interface WorkspaceHomeProps {
  activeWorkspace: Workspace;
}

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ activeWorkspace }) => {
  return (
    <div className="workspace-home-container" style={{ padding: '2rem' }}>
      <header className="workspace-header" style={{ marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#2c3e50' }}>{activeWorkspace.name}</h1>
        <span className="role-badge" style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.2rem 0.6rem', backgroundColor: '#e8f4f8', color: '#2980b9', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
          Role: {activeWorkspace.role}
        </span>
      </header>

      <section className="workspace-content">
        <StorageLocationList workspaceId={activeWorkspace.id} />
      </section>
    </div>
  );
};
