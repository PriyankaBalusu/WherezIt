import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStorageLocations } from '../hooks/useStorageLocations';
import { useContainers } from '../../containers/hooks/useContainers';
import { useWorkspaceContext } from '../../workspaces/context/WorkspaceContext';
import { getStorageSpaceDisplayName } from '../../workspaces/utils/formatWorkspaceName';

export const LocationDetailScreen: React.FC = () => {
  const { workspaceId, locationId } = useParams<{ workspaceId: string; locationId: string }>();
  const navigate = useNavigate();

  const { data: locations = [], isLoading: isLocationsLoading } = useStorageLocations(workspaceId || '');
  const { data: containers = [], isLoading: isContainersLoading } = useContainers(workspaceId || '', locationId);

  if (isLocationsLoading || isContainersLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        Loading location details...
      </div>
    );
  }

  const currentLocation = locations.find((l) => l.id === locationId);

  if (!currentLocation) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <h2 style={{ color: '#0f172a' }}>Location Not Found</h2>
        <p style={{ color: '#64748b' }}>The requested storage location could not be found.</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          Return Home
        </button>
      </div>
    );
  }

  // Build breadcrumb trail
  const breadcrumbs: { id: string; name: string }[] = [];
  let curr: typeof currentLocation | undefined = currentLocation;

  while (curr) {
    breadcrumbs.unshift({ id: curr.id, name: curr.name });
    curr = locations.find((l) => l.id === curr?.parentId);
  }

  // Find child locations
  const childLocations = locations.filter((l) => l.parentId === currentLocation.id);

  // Filter boxes stored directly in this location
  const directBoxes = containers.filter((c) => c.storageNodeId === currentLocation.id && !c.isArchived);

  const workspaceContext = useWorkspaceContext();
  const workspace = workspaceContext?.workspaces?.find((w) => w.id === workspaceId);
  const spaceName = getStorageSpaceDisplayName(workspace?.name || 'Storage Space');

  return (
    <div style={{ maxWidth: '1000px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Breadcrumb Trail */}
      <nav aria-label="Location Breadcrumb" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center', fontSize: '0.875rem' }}>
        <Link to="/" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
          Home
        </Link>
        <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>/</span>
        <Link
          to={`/workspaces/${workspaceId}`}
          style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
        >
          {spaceName}
        </Link>
        {breadcrumbs.map((b, idx) => (
          <React.Fragment key={b.id}>
            <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>/</span>
            {idx === breadcrumbs.length - 1 ? (
              <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 700 }}>{b.name}</span>
            ) : (
              <Link
                to={`/workspaces/${workspaceId}/locations/${b.id}`}
                style={{ color: 'var(--color-primary-text, #0284c7)', textDecoration: 'none', fontWeight: 600 }}
              >
                {b.name}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Location Header & Summary */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-card-bg, #ffffff)', border: '1px solid var(--color-card-border, #e2e8f0)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-text, #0284c7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              STORAGE LOCATION
            </span>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--color-text, #0f172a)' }}>
              📍 {currentLocation.name}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ backgroundColor: 'var(--color-primary-light, #e0f2fe)', color: 'var(--color-primary-text, #0369a1)', padding: '0.375rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 700 }}>
              {directBoxes.length} {directBoxes.length === 1 ? 'box' : 'boxes'}
            </span>
            <span style={{ backgroundColor: 'var(--color-bg-subtle, #f1f5f9)', color: 'var(--color-text-muted, #475569)', padding: '0.375rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 700 }}>
              {childLocations.length} {childLocations.length === 1 ? 'sub-location' : 'sub-locations'}
            </span>
          </div>
        </div>
      </div>

      {/* Child Sub-locations */}
      {childLocations.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.75rem' }}>
            Sub-locations
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {childLocations.map((sub) => {
              const subBoxesCount = containers.filter((c) => c.storageNodeId === sub.id && !c.isArchived).length;
              return (
                <Link
                  key={sub.id}
                  to={`/workspaces/${workspaceId}/locations/${sub.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="card"
                    style={{
                      padding: '1.25rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.625rem',
                      transition: 'all 150ms ease-in-out',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🗄️</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text, #0f172a)' }}>{sub.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.25rem' }}>
                      {subBoxesCount} {subBoxesCount === 1 ? 'box' : 'boxes'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Boxes Directly in Location */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.75rem' }}>
          Boxes Stored Here
        </h2>
        {directBoxes.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted, #64748b)', backgroundColor: 'var(--color-bg-subtle, #f8fafc)', border: '1px dashed var(--color-border, #cbd5e1)' }}>
            No boxes stored directly in {currentLocation.name}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {directBoxes.map((box) => (
              <Link
                key={box.id}
                to={`/workspaces/${workspaceId}/containers/${box.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{
                    padding: '1.25rem',
                    border: '1px solid var(--color-card-border, #e2e8f0)',
                    backgroundColor: 'var(--color-card-bg, #ffffff)',
                    borderRadius: '0.625rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: 'var(--color-primary-light, #e0f2fe)', color: 'var(--color-primary-text, #0369a1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 800 }}>
                      {box.boxId}
                    </span>
                    {box.physicalLabel && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-text, #0284c7)', fontWeight: 600 }}>
                        🏷️ {box.physicalLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text, #0f172a)', marginBottom: '0.25rem' }}>
                    📦 {box.name}
                  </div>
                  {box.description && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.4 }}>
                      {box.description}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
