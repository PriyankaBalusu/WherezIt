import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import { useContainers } from '../hooks/useContainers';

interface ContainerListProps {
  workspaceId: string;
  selectedLocationId?: string | null;
  onAddBox?: () => void;
}

export const ContainerList: React.FC<ContainerListProps> = ({
  workspaceId,
  selectedLocationId = null,
  onAddBox,
}) => {
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data: locations = [] } = useStorageLocations(workspaceId);
  const { data: containers = [], isLoading, isError, error, refetch } = useContainers(
    workspaceId,
    selectedLocationId || undefined,
    includeArchived
  );

  if (isLoading) {
    return <div style={{ color: '#64748b', padding: '1rem' }}>Loading containers...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: '#dc2626', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fca5a5' }}>
        <p>Error loading containers: {(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn-secondary" style={{ marginTop: '0.5rem' }}>Retry</button>
      </div>
    );
  }

  const getLocationName = (nodeId: string) => {
    return locations.find((l) => l.id === nodeId)?.name || nodeId;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Container List Grid */}
      {containers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>No boxes here yet</h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem' }}>Create a box to start organizing items in this location.</p>
          <button type="button" className="btn-primary" onClick={onAddBox}>
            + Add Box
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {containers.map((container) => (
            <Link
              key={container.id}
              to={`/workspaces/${workspaceId}/containers/${container.id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                outline: 'none',
              }}
            >
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  backgroundColor: container.isArchived ? '#f8fafc' : '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                  opacity: container.isArchived ? 0.75 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
                  minHeight: '130px',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Navigate automatically via Link
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className="badge badge-boxid">
                    {container.boxId}
                  </span>
                </div>

                <div>
                  <h4 style={{ margin: '0.125rem 0', color: '#0f172a', fontSize: '1.1rem', fontWeight: 700 }}>
                    {container.name || 'Unnamed Box'}
                  </h4>

                  {container.description && (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {container.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#475569', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <span>📍 {getLocationName(container.storageNodeId)}</span>
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>Open Box →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Show Archived Boxes Toggle Below Grid */}
      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
        <label style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show Archived Boxes
        </label>
      </div>
    </div>
  );
};




