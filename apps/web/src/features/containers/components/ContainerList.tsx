import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import { useContainers } from '../hooks/useContainers';

interface ContainerListProps {
  workspaceId: string;
  selectedLocationId?: string | null;
  onAddBox?: () => void;
}

type SortOption = 'BOX_NUMBER' | 'NAME' | 'ITEM_COUNT';
type FilterOption = 'ACTIVE' | 'ALL' | 'ARCHIVED' | 'PACKED' | 'UNPACKED';

export const HOME_BOX_PREVIEW_LIMIT = 9;

export const ContainerList: React.FC<ContainerListProps> = ({
  workspaceId,
  selectedLocationId = null,
  onAddBox,
}) => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('BOX_NUMBER');
  const [filterBy, setFilterBy] = useState<FilterOption>('ACTIVE');
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset expanded state whenever context or filter changes
  React.useEffect(() => {
    setIsExpanded(false);
  }, [workspaceId, selectedLocationId, sortBy, filterBy]);

  const includeArchived = filterBy === 'ALL' || filterBy === 'ARCHIVED';

  const { data: locations = [] } = useStorageLocations(workspaceId);
  const { data: containers = [], isLoading, isError, error, refetch } = useContainers(
    workspaceId,
    selectedLocationId || undefined,
    includeArchived
  );

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  const getLocationBreadcrumb = (nodeId: string): string => {
    const segments: string[] = [];
    let curr: string | null = nodeId;
    const visited = new Set<string>();

    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const loc = locations.find((l) => l.id === curr);
      if (!loc) break;
      segments.unshift(loc.name);
      curr = loc.parentId;
    }

    return segments.length > 0 ? segments.join(' › ') : 'Unassigned Location';
  };

  const filteredContainers = containers.filter((c) => {
    if (filterBy === 'ACTIVE') return !c.isArchived;
    if (filterBy === 'ARCHIVED') return c.isArchived;
    if (filterBy === 'PACKED') return !c.isArchived && c.isPacked;
    if (filterBy === 'UNPACKED') return !c.isArchived && !c.isPacked;
    return true; // 'ALL': includes active + archived
  });

  const sortedContainers = [...filteredContainers].sort((a, b) => {
    if (sortBy === 'NAME') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'ITEM_COUNT') {
      return (b.itemCount ?? 0) - (a.itemCount ?? 0);
    }
    return a.boxNumber - b.boxNumber;
  });

  const totalCount = sortedContainers.length;
  const sectionTitle = selectedLocation
    ? `${selectedLocation.name} · ${totalCount === 1 ? '1 box' : `${totalCount} boxes`}`
    : `All Boxes · ${totalCount === 1 ? '1 box' : totalCount}`;

  const visibleContainers = isExpanded
    ? sortedContainers
    : sortedContainers.slice(0, HOME_BOX_PREVIEW_LIMIT);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Box Section Heading & Cohesive Box Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', margin: 0 }}>
          {sectionTitle}
        </h2>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 600 }}>Sort:</span>
            <select
              aria-label="Sort boxes"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid var(--color-input-border, #cbd5e1)',
                borderRadius: '0.375rem',
                backgroundColor: 'var(--color-input-bg, #ffffff)',
                color: 'var(--color-text, #0f172a)',
                outline: 'none',
              }}
            >
              <option value="BOX_NUMBER">Box #</option>
              <option value="NAME">Name</option>
              <option value="ITEM_COUNT">Item Count</option>
            </select>
          </div>

          {/* Filter Selector (Includes Archived Options) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 600 }}>Filter:</span>
            <select
              aria-label="Filter boxes"
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid var(--color-input-border, #cbd5e1)',
                borderRadius: '0.375rem',
                backgroundColor: 'var(--color-input-bg, #ffffff)',
                color: 'var(--color-text, #0f172a)',
                outline: 'none',
              }}
            >
              <option value="ACTIVE">Active Boxes</option>
              <option value="ALL">All Boxes (Active + Archived)</option>
              <option value="ARCHIVED">Archived Only</option>
              <option value="PACKED">Packed Only</option>
              <option value="UNPACKED">Unpacked Only</option>
            </select>
          </div>

          {/* Add Box Button */}
          {onAddBox && (
            <button
              type="button"
              className="btn btn-primary btn--md"
              onClick={onAddBox}
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.85rem' }}
            >
              + Add Box
            </button>
          )}
        </div>
      </div>

      {/* Container List Grid */}
      {sortedContainers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-muted, #64748b)', backgroundColor: 'var(--color-card-bg, #f8fafc)', borderRadius: '0.5rem', border: '1px dashed var(--color-border-strong, #cbd5e1)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text, #0f172a)', fontSize: '1.1rem' }}>No boxes here yet</h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem' }}>Create a box to start organizing items in this location.</p>
          {onAddBox && (
            <button type="button" className="btn btn-primary btn--md" onClick={onAddBox}>
              + Add Box
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {visibleContainers.map((container) => {
              const breadcrumbPath = getLocationBreadcrumb(container.storageNodeId);
              const count = container.itemCount ?? 0;

              return (
                <div
                  key={container.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/workspaces/${workspaceId}/containers/${container.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/workspaces/${workspaceId}/containers/${container.id}`);
                    }
                  }}
                  className="box-card-tile"
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-boxid">
                        {container.boxId}
                      </span>
                      {container.isArchived && (
                        <span className="badge badge-archived" style={{ backgroundColor: 'var(--color-bg-subtle, #f1f5f9)', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, #cbd5e1)', fontSize: '0.75rem', fontWeight: 600 }}>
                          Archived
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '0.125rem 0 0.375rem 0', color: container.isArchived ? 'var(--color-text-muted, #64748b)' : 'var(--color-text, #0f172a)', fontSize: '1.15rem', fontWeight: 700 }}>
                      {container.name || 'Unnamed Box'}
                    </h3>

                    {container.description && (
                      <p style={{
                        fontSize: '0.85rem',
                        color: container.isArchived ? 'var(--color-text-muted, #94a3b8)' : 'var(--color-text-muted, #64748b)',
                        margin: '0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {container.description}
                      </p>
                    )}
                  </div>

                  <div className="box-card-tile__divider" />

                  {/* Card Footer: Metadata Stack + Arrow */}
                  <div className="box-card-tile__footer">
                    <div className="box-card-tile__meta">
                      <span className="box-card-tile__path" title={breadcrumbPath}>
                        📍 {breadcrumbPath}
                      </span>
                      <span className="box-card-tile__items-count">
                        📦 {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <span className="box-card-tile__arrow" aria-hidden="true">›</span>
                  </div>
                </div>
              );
            })}
          </div>

          {sortedContainers.length > HOME_BOX_PREVIEW_LIMIT && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              {!isExpanded ? (
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  onClick={() => setIsExpanded(true)}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  View all boxes ({sortedContainers.length - HOME_BOX_PREVIEW_LIMIT} more) →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  onClick={() => setIsExpanded(false)}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  Show fewer
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
