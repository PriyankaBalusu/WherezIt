import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workspace } from '../types/workspace';
import { WorkspaceSelector } from './WorkspaceSelector';
import { WorkspaceManageMenu } from './WorkspaceManageMenu';
import { DEFAULT_SEARCH_SUGGESTIONS } from './WorkspaceHome';
import './MobileHomeLayout.css';

function getLocationIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('garage')) return '🏚️';
  if (n.includes('suite') || n.includes('office')) return '🏢';
  if (n.includes('rack') || n.includes('shelf')) return '🪜';
  if (n.includes('closet') || n.includes('cabinet') || n.includes('drawer')) return '🗄️';
  if (n.includes('attic') || n.includes('roof')) return '🏠';
  if (n.includes('basement') || n.includes('cellar')) return '⚓';
  if (n.includes('box')) return '📦';
  return '📁';
}

interface MobileHomeLayoutProps {
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  locations: any[];
  containers: any[];
  selectedLocationId: string | null;
  onSelectLocation: (id: string | null) => void;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onOpenAddLocation: (parentId: string | null) => void;
  onOpenAddBox: () => void;
  onRenameLocation?: (id: string, name: string) => void;
}

export const MobileHomeLayout: React.FC<MobileHomeLayoutProps> = ({
  activeWorkspace,
  workspaces,
  locations,
  containers,
  selectedLocationId,
  onSelectLocation,
  onSelectWorkspace,
  onCreateWorkspace,
  onOpenAddLocation,
  onOpenAddBox,
  onRenameLocation,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAllLocationsView, setIsAllLocationsView] = useState(false);
  const [filterBy, setFilterBy] = useState<'active' | 'all' | 'archived'>('active');
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'items'>('number');
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset expanded state back to 10-box preview whenever filtering/context changes
  React.useEffect(() => {
    setIsExpanded(false);
  }, [activeWorkspace.id, selectedLocationId, filterBy, sortBy]);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSuggestionClick = (query: string) => {
    setSearchQuery(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  // Location box counts helper (recursive for location + all sublocations)
  const getBoxCountForLocation = useCallback((locationId: string): number => {
    const childIds = new Set<string>([locationId]);
    const findChildren = (pid: string) => {
      locations.filter((l) => l.parentId === pid).forEach((c) => {
        childIds.add(c.id);
        findChildren(c.id);
      });
    };
    findChildren(locationId);

    return containers.filter((b) => !b.isArchived && childIds.has(b.storageNodeId)).length;
  }, [containers, locations]);

  // Sublocation count helper
  const getSublocationCount = useCallback((locationId: string): number => {
    return locations.filter((l) => l.parentId === locationId).length;
  }, [locations]);

  // Direct child sublocations of selected location
  const currentSublocations = useMemo(() => {
    if (!selectedLocationId) return [];
    return locations.filter((l) => l.parentId === selectedLocationId);
  }, [locations, selectedLocationId]);

  // Full breadcrumb hierarchy
  const breadcrumbs = useMemo(() => {
    const list: { id: string | null; name: string }[] = [{ id: null, name: activeWorkspace.name }];
    if (!selectedLocationId) return list;

    const path: { id: string; name: string }[] = [];
    let currentId: string | null = selectedLocationId;
    while (currentId) {
      const loc = locations.find((l) => l.id === currentId);
      if (!loc) break;
      path.unshift({ id: loc.id, name: loc.name });
      currentId = loc.parentId;
    }
    return [...list, ...path];
  }, [activeWorkspace.name, locations, selectedLocationId]);

  // Location path helper for box row
  const getLocationPath = (storageNodeId: string): string => {
    const path: string[] = [];
    let currentId: string | null = storageNodeId;
    while (currentId) {
      const loc = locations.find((l) => l.id === currentId);
      if (!loc) break;
      path.unshift(loc.name);
      currentId = loc.parentId;
    }
    return [activeWorkspace.name, ...path].join(' › ');
  };

  // Direct boxes in current location (for drill-down view) vs all filtered boxes (for home view)
  const currentDirectBoxes = useMemo(() => {
    if (!selectedLocationId) return [];
    return containers.filter((b) => {
      if (b.storageNodeId !== selectedLocationId) return false;
      if (filterBy === 'active') return !b.isArchived;
      if (filterBy === 'archived') return b.isArchived;
      return true;
    });
  }, [containers, selectedLocationId, filterBy]);

  const filteredContainers = useMemo(() => {
    let result = containers.filter((c) => {
      if (filterBy === 'active') return !c.isArchived;
      if (filterBy === 'archived') return c.isArchived;
      return true;
    });

    if (selectedLocationId) {
      const locIds = new Set<string>([selectedLocationId]);
      const addChildren = (pid: string) => {
        locations.filter((l) => l.parentId === pid).forEach((c) => {
          locIds.add(c.id);
          addChildren(c.id);
        });
      };
      addChildren(selectedLocationId);
      result = result.filter((b) => locIds.has(b.storageNodeId));
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'items') return (b.itemCount || 0) - (a.itemCount || 0);
      return (a.boxNumber || 0) - (b.boxNumber || 0);
    });

    return result;
  }, [containers, filterBy, sortBy, selectedLocationId, locations]);

  const visibleBoxes = useMemo(() => {
    return isExpanded ? filteredContainers : filteredContainers.slice(0, 9);
  }, [filteredContainers, isExpanded]);

  // Top-level root locations for Home Preview
  const topLocations = useMemo(() => {
    const rootLocations = locations.filter((l) => !l.parentId);
    return (rootLocations.length > 0 ? rootLocations : locations).slice(0, 4);
  }, [locations]);

  // Back handler for location drill-down
  const handleBack = () => {
    if (isAllLocationsView) {
      setIsAllLocationsView(false);
      return;
    }
    if (selectedLocation) {
      onSelectLocation(selectedLocation.parentId);
    } else {
      onSelectLocation(null);
    }
  };

  // VIEW 4: Dedicated ALL LOCATIONS View
  if (isAllLocationsView) {
    return (
      <div className="mobile-home-layout mobile-view-all-locations-screen" data-layout="mobile">
        {/* Navy Header */}
        <header className="mobile-top-bar">
          <button type="button" className="mobile-back-btn" onClick={() => setIsAllLocationsView(false)}>
            ‹ Back
          </button>
          <h1 className="mobile-top-bar-title">All Locations</h1>
          <button
            type="button"
            className="mobile-top-action-btn"
            onClick={() => onOpenAddLocation(null)}
            title="Add Location"
          >
            +
          </button>
        </header>

        {/* Breadcrumb */}
        <div className="mobile-breadcrumb-bar">
          <span className="mobile-breadcrumb-item">{activeWorkspace.name}</span>
        </div>

        {/* All Locations List */}
        <div className="mobile-locations-full-list">
          {locations.map((loc) => {
            const boxCount = getBoxCountForLocation(loc.id);
            const subCount = getSublocationCount(loc.id);
            return (
              <button
                key={loc.id}
                type="button"
                className="mobile-location-row"
                onClick={() => {
                  onSelectLocation(loc.id);
                  setIsAllLocationsView(false);
                }}
              >
                <div className="mobile-location-row-left">
                  <span className="mobile-location-icon">{getLocationIcon(loc.name)}</span>
                  <span className="mobile-location-name">{loc.name}</span>
                </div>
                <div className="mobile-location-row-right">
                  <span className="mobile-location-box-count">
                    {boxCount} {boxCount === 1 ? 'box' : 'boxes'}
                    {subCount > 0 && ` · ${subCount} ${subCount === 1 ? 'location' : 'locations'}`}
                  </span>
                  <span className="mobile-chevron">›</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // VIEW 2 & 3: LOCATION / SUBLOCATION DRILL-DOWN VIEW
  if (selectedLocation) {
    const totalBoxesInTree = getBoxCountForLocation(selectedLocation.id);
    const subCount = getSublocationCount(selectedLocation.id);

    return (
      <div className="mobile-home-layout mobile-location-drilldown" data-layout="mobile">
        {/* Navy Header */}
        <header className="mobile-top-bar">
          <button type="button" className="mobile-back-btn" onClick={handleBack}>
            ‹ Back
          </button>
          <h1 className="mobile-top-bar-title">{selectedLocation.name}</h1>
          <span style={{ width: '44px' }} />
        </header>

        {/* Dynamic Breadcrumbs */}
        <nav className="mobile-breadcrumb-bar" aria-label="Location hierarchy">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <span className="mobile-breadcrumb-sep">›</span>}
              <button
                type="button"
                className={`mobile-breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'mobile-breadcrumb-item--current' : ''}`}
                onClick={() => onSelectLocation(crumb.id)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </nav>

        {/* Current Location Summary Card */}
        <section className="mobile-card mobile-current-location-card">
          <div className="mobile-current-location-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="mobile-current-location-icon">
                {getLocationIcon(selectedLocation.name)}
              </span>
              <div className="mobile-current-location-info">
                <h2 className="mobile-current-location-title" style={{ margin: 0 }}>{selectedLocation.name}</h2>
                <span className="mobile-current-location-meta">
                  {totalBoxesInTree} {totalBoxesInTree === 1 ? 'box' : 'boxes'}
                  {subCount > 0 && ` · ${subCount} ${subCount === 1 ? 'sublocation' : 'sublocations'}`}
                </span>
              </div>
            </div>
            {onRenameLocation && (
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                onClick={() => onRenameLocation(selectedLocation.id, selectedLocation.name)}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              >
                ✏️ Rename
              </button>
            )}
          </div>
        </section>

        {/* Sublocations Section */}
        <section className="mobile-sublocations-section">
          <div className="mobile-section-header-row">
            <h3 className="mobile-section-heading">Sublocations</h3>
            <button
              type="button"
              className="btn btn-secondary btn--sm mobile-add-sublocation-btn"
              onClick={() => onOpenAddLocation(selectedLocation.id)}
            >
              + Add Sublocation
            </button>
          </div>

          {currentSublocations.length > 0 ? (
            <div className="mobile-sublocation-list">
              {currentSublocations.map((sub) => {
                const bCount = getBoxCountForLocation(sub.id);
                const sCount = getSublocationCount(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className="mobile-location-row"
                    onClick={() => onSelectLocation(sub.id)}
                  >
                    <div className="mobile-location-row-left">
                      <span className="mobile-location-icon">{getLocationIcon(sub.name)}</span>
                      <span className="mobile-location-name">{sub.name}</span>
                    </div>
                    <div className="mobile-location-row-right">
                      <span className="mobile-location-box-count">
                        {bCount} {bCount === 1 ? 'box' : 'boxes'}
                        {sCount > 0 && ` · ${sCount} ${sCount === 1 ? 'sublocation' : 'sublocations'}`}
                      </span>
                      <span className="mobile-chevron">›</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mobile-empty-sublocations">
              <span>No sublocations yet.</span>
            </div>
          )}
        </section>

        {/* Direct Boxes Panel */}
        <section className="mobile-card mobile-boxes-card">
          <div className="mobile-card-header">
            <span className="mobile-card-title">
              Boxes in {selectedLocation.name} · {currentDirectBoxes.length} {currentDirectBoxes.length === 1 ? 'box' : 'boxes'}
            </span>
            <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenAddBox}>
              + Add Box
            </button>
          </div>

          <div className="mobile-boxes-toolbar">
            <button
              type="button"
              className={`mobile-filter-pill ${filterBy === 'active' ? 'mobile-filter-pill--active' : ''}`}
              onClick={() => setFilterBy('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`mobile-filter-pill ${filterBy === 'archived' ? 'mobile-filter-pill--active' : ''}`}
              onClick={() => setFilterBy('archived')}
            >
              Archived
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="mobile-select-sort"
              aria-label="Sort boxes"
            >
              <option value="number">Sort: #</option>
              <option value="name">Sort: Name</option>
              <option value="items">Sort: Items</option>
            </select>
          </div>

          {currentDirectBoxes.length > 0 ? (
            <div className="mobile-box-list">
              {currentDirectBoxes.map((box) => (
                <div
                  key={box.id}
                  className="mobile-box-row"
                  onClick={() => navigate(`/workspaces/${activeWorkspace.id}/containers/${box.id}`)}
                  role="link"
                  tabIndex={0}
                >
                  <div className="mobile-box-thumb-container">
                    <span className="mobile-box-icon">📦</span>
                  </div>
                  <div className="mobile-box-row-info">
                    <div className="mobile-box-row-top">
                      <span className="badge badge-boxid mobile-box-pill">{box.boxId}</span>
                    </div>
                    <span className="mobile-box-name">{box.name || 'Unnamed Box'}</span>
                    <div className="mobile-box-row-sub">
                      <span className="mobile-box-location">📍 {getLocationPath(box.storageNodeId)}</span>
                      <span className="mobile-box-items-count">📦 {box.itemCount ?? 0} items</span>
                    </div>
                  </div>
                  <span className="mobile-box-chevron">›</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mobile-empty-boxes">
              <p>No boxes stored directly in {selectedLocation.name}.</p>
              <button type="button" className="btn btn-primary btn--sm" onClick={onOpenAddBox}>
                + Add Box
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  // VIEW 1: DEFAULT HOME SCREEN VIEW
  return (
    <div className="mobile-home-layout" data-layout="mobile">
      {/* 1. Compact Search + Scan Row */}
      <section className="mobile-search-section">
        <form onSubmit={handleSearchSubmit} className="mobile-search-form">
          <div className="mobile-search-input-wrapper">
            <span className="mobile-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="mobile-search-input"
              placeholder="What are you looking for?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search stored items or boxes"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary mobile-search-button"
          >
            Search
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="mobile-search-suggestions">
          <span className="mobile-chips-label">Try:</span>
          <div className="mobile-chip-list">
            {DEFAULT_SEARCH_SUGGESTIONS.map((chip, index) => (
              <button
                key={chip.id}
                type="button"
                className={`mobile-chip ${index >= 2 ? 'mobile-chip--secondary' : ''}`}
                onClick={() => handleSuggestionClick(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Storage Space Card */}
      <section className="mobile-card mobile-storage-space-card">
        <div className="mobile-card-header">
          <span className="mobile-card-title">Storage Space</span>
        </div>
        <div className="mobile-storage-selector-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            {workspaces.length > 0 && (
              <WorkspaceSelector
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspace.id}
                onSelectWorkspace={onSelectWorkspace}
                onCreateWorkspace={onCreateWorkspace}
              />
            )}
          </div>
          <WorkspaceManageMenu workspace={activeWorkspace} />
        </div>
      </section>

      {/* 3. Browse Locations — Compact Preview */}
      <section className="mobile-card mobile-locations-card">
        <div className="mobile-card-header">
          <span className="mobile-card-title">Browse Locations</span>
          <button
            type="button"
            className="mobile-view-all-locations-btn"
            onClick={() => setIsAllLocationsView(true)}
          >
            View all →
          </button>
        </div>

        {locations.length > 0 ? (
          <div className="mobile-locations-preview-list">
            {topLocations.map((loc) => {
              const boxCount = getBoxCountForLocation(loc.id);
              const subCount = getSublocationCount(loc.id);
              return (
                <button
                  key={loc.id}
                  type="button"
                  className="mobile-location-row"
                  onClick={() => onSelectLocation(loc.id)}
                >
                  <div className="mobile-location-row-left">
                    <span className="mobile-location-icon">{getLocationIcon(loc.name)}</span>
                    <span className="mobile-location-name">{loc.name}</span>
                  </div>
                  <div className="mobile-location-row-right">
                    <span className="mobile-location-box-count">
                      {boxCount} {boxCount === 1 ? 'box' : 'boxes'}
                      {subCount > 0 && ` · ${subCount} ${subCount === 1 ? 'sublocation' : 'sublocations'}`}
                    </span>
                    <span className="mobile-chevron">›</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mobile-empty-locations">
            <span>No locations yet</span>
            <button
              type="button"
              className="btn btn-secondary btn--sm"
              onClick={() => onOpenAddLocation(null)}
            >
              + Add Location
            </button>
          </div>
        )}
      </section>

      {/* 4. Compact Box List Panel */}
      <section className="mobile-card mobile-boxes-card">
        <div className="mobile-card-header">
          <span className="mobile-card-title">
            All Boxes · {filteredContainers.length}
          </span>
          <button type="button" className="btn btn-secondary btn--sm" onClick={onOpenAddBox}>
            + Add Box
          </button>
        </div>

        <div className="mobile-boxes-toolbar">
          <button
            type="button"
            className={`mobile-filter-pill ${filterBy === 'active' ? 'mobile-filter-pill--active' : ''}`}
            onClick={() => setFilterBy('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={`mobile-filter-pill ${filterBy === 'archived' ? 'mobile-filter-pill--active' : ''}`}
            onClick={() => setFilterBy('archived')}
          >
            Archived
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="mobile-select-sort"
            aria-label="Sort boxes"
          >
            <option value="number">Sort: #</option>
            <option value="name">Sort: Name</option>
            <option value="items">Sort: Items</option>
          </select>
        </div>

        {visibleBoxes.length > 0 ? (
          <div className="mobile-box-list">
            {visibleBoxes.map((box) => {
              const locPath = getLocationPath(box.storageNodeId);
              return (
                <div
                  key={box.id}
                  className="mobile-box-row"
                  onClick={() => navigate(`/workspaces/${activeWorkspace.id}/containers/${box.id}`)}
                  role="link"
                  tabIndex={0}
                >
                  <div className="mobile-box-thumb-container">
                    <span className="mobile-box-icon">📦</span>
                  </div>
                  <div className="mobile-box-row-info">
                    <div className="mobile-box-row-top">
                      <span className="badge badge-boxid mobile-box-pill">{box.boxId}</span>
                    </div>
                    <span className="mobile-box-name">{box.name || 'Unnamed Box'}</span>
                    <div className="mobile-box-row-sub">
                      <span className="mobile-box-location">📍 {locPath}</span>
                      <span className="mobile-box-items-count">📦 {box.itemCount ?? 0} items</span>
                    </div>
                  </div>
                  <span className="mobile-box-chevron">›</span>
                </div>
              );
            })}

            {filteredContainers.length > 9 && (
              <button
                type="button"
                className="mobile-show-more-btn"
                onClick={() => setIsExpanded((prev) => !prev)}
              >
                {!isExpanded
                  ? `View all boxes (${filteredContainers.length - 9} more) →`
                  : 'Show fewer'}
              </button>
            )}
          </div>
        ) : (
          <div className="mobile-empty-boxes">
            <p>No boxes found matching your filter.</p>
            <button type="button" className="btn btn-primary btn--sm" onClick={onOpenAddBox}>
              + Add Box
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
