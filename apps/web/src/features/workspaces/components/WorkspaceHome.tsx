import React, { useState } from 'react';
import { Workspace } from '../types/workspace';
import { StorageLocationList } from '../../locations/components/StorageLocationList';
import { ContainerList } from '../../containers/components/ContainerList';

interface WorkspaceHomeProps {
  activeWorkspace: Workspace;
}

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ activeWorkspace }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <div className="app-container" style={{ padding: '2rem 1rem' }}>
      {/* Search Hero Banner */}
      <section
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '1rem',
          padding: '2.5rem 2rem',
          marginBottom: '2.5rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '650px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            STORAGE COMMAND CENTER
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem', marginBottom: '0.25rem', color: '#ffffff' }}>
            {activeWorkspace.name}
          </h1>
          <div style={{ marginBottom: '1rem' }}>
            <span className="badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              Role: {activeWorkspace.role}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Search your stored inventory, manage locations, and pack containers effortlessly.
          </p>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input
              type="text"
              placeholder="Search stored items, containers, or locations... (e.g. Christmas lights)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                fontSize: '0.95rem',
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Quick Action Shortcuts */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <a
          href={`/workspaces/${activeWorkspace.id}/quick-pack`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="card" style={{ borderLeft: '4px solid #0284c7', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>Quick Pack</span>
              <span style={{ fontSize: '1.25rem' }}>📦</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
              Guided workflow to pack a box, add location metadata, and scan/photo contents.
            </p>
          </div>
        </a>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>Storage Hierarchy</span>
            <span style={{ fontSize: '1.25rem' }}>📍</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Organize rooms, racks, and shelves to maintain clear location breadcrumbs.
          </p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #16a34a', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>AI Contents Recognition</span>
            <span style={{ fontSize: '1.25rem' }}>✨</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Upload container photos to automatically detect items for explicit human review.
          </p>
        </div>
      </section>

      {/* Main Workspace Sections */}
      <section className="workspace-content" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <StorageLocationList workspaceId={activeWorkspace.id} />
        <ContainerList workspaceId={activeWorkspace.id} />
      </section>
    </div>
  );
};
