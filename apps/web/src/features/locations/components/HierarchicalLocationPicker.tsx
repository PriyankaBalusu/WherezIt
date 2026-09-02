import React, { useState } from 'react';
import { StorageLocation } from '../types/location';
import './HierarchicalLocationPicker.css';

export interface HierarchicalLocationPickerProps {
  locations: StorageLocation[];
  selectedLocationId: string | null;
  onSelectLocation: (locationId: string | null) => void;
  title?: string;
  allowAll?: boolean;
  allLabel?: string;
  buttonLabel?: string;
}

export const HierarchicalLocationPicker: React.FC<HierarchicalLocationPickerProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation,
  title = 'Select Location',
  allowAll = true,
  allLabel = 'All Locations',
  buttonLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);

  // Helper to build location breadcrumb string
  const getLocationBreadcrumb = (locId: string | null | undefined): string => {
    if (!locId) return allowAll ? allLabel : 'Select location...';
    const crumbs: string[] = [];
    let currId: string | null | undefined = locId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const loc = locations.find((l) => l.id === currId);
      if (!loc) break;
      crumbs.unshift(loc.name);
      currId = loc.parentId;
    }
    return crumbs.join(' › ') || (allowAll ? allLabel : 'Select location...');
  };

  // Get children of current parent node
  const currentChildren = locations.filter((loc) => (loc.parentId || null) === (currentParentId || null));

  // Get active parent node object
  const currentParent = locations.find((l) => l.id === currentParentId);

  // Breadcrumbs path for navigation in modal
  const getNavCrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: allowAll ? allLabel : 'Top Level' }];
    let currId: string | null | undefined = currentParentId;
    const path: { id: string; name: string }[] = [];
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const loc = locations.find((l) => l.id === currId);
      if (!loc) break;
      path.unshift({ id: loc.id, name: loc.name });
      currId = loc.parentId;
    }
    return [...crumbs, ...path];
  };

  const handleSelectCurrentNode = (id: string | null) => {
    onSelectLocation(id);
    setIsOpen(false);
  };

  const selectedDisplay = buttonLabel || getLocationBreadcrumb(selectedLocationId);

  return (
    <div className="hierarchical-location-picker">
      <button
        type="button"
        className="hl-picker-trigger-btn"
        onClick={() => setIsOpen(true)}
      >
        <span className="hl-picker-trigger-icon">📍</span>
        <span className="hl-picker-trigger-text">{selectedDisplay}</span>
        <span className="hl-picker-trigger-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="hl-picker-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="hl-picker-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="hl-picker-header">
              <h3>{title}</h3>
              <button
                type="button"
                className="hl-picker-close-btn"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Navigation Breadcrumb */}
            <div className="hl-picker-nav-crumbs">
              {getNavCrumbs().map((crumb, idx, arr) => (
                <React.Fragment key={crumb.id || 'root'}>
                  <button
                    type="button"
                    className={`hl-crumb-btn ${idx === arr.length - 1 ? 'active' : ''}`}
                    onClick={() => setCurrentParentId(crumb.id)}
                  >
                    {crumb.name}
                  </button>
                  {idx < arr.length - 1 && <span className="hl-crumb-sep">›</span>}
                </React.Fragment>
              ))}
            </div>

            {/* Select current level button */}
            <div className="hl-picker-actions">
              <button
                type="button"
                className="btn btn-primary btn--sm hl-select-level-btn"
                onClick={() => handleSelectCurrentNode(currentParentId)}
              >
                {currentParentId
                  ? `Select "${currentParent?.name}" (includes sublocations)`
                  : allowAll
                  ? `Select All Locations`
                  : `Select Top Level`}
              </button>
            </div>

            {/* Child locations list */}
            <div className="hl-picker-node-list">
              {allowAll && currentParentId === null && (
                <button
                  type="button"
                  className={`hl-node-item ${selectedLocationId === null ? 'selected' : ''}`}
                  onClick={() => handleSelectCurrentNode(null)}
                >
                  <span>📍 All Locations</span>
                  <span className="hl-node-check">{selectedLocationId === null ? '✓' : ''}</span>
                </button>
              )}

              {currentChildren.map((loc) => {
                const hasSublocations = locations.some((l) => l.parentId === loc.id);
                const isSelected = selectedLocationId === loc.id;

                return (
                  <div key={loc.id} className={`hl-node-row ${isSelected ? 'selected' : ''}`}>
                    <button
                      type="button"
                      className="hl-node-select-btn"
                      onClick={() => handleSelectCurrentNode(loc.id)}
                    >
                      <span className="hl-node-name">{loc.name}</span>
                      {isSelected && <span className="hl-node-check">✓</span>}
                    </button>

                    {hasSublocations && (
                      <button
                        type="button"
                        className="hl-node-drill-btn"
                        onClick={() => setCurrentParentId(loc.id)}
                        aria-label={`View sublocations of ${loc.name}`}
                      >
                        Sublocations ›
                      </button>
                    )}
                  </div>
                );
              })}

              {currentChildren.length === 0 && (
                <div className="hl-picker-empty">
                  No sublocations found in {currentParent?.name || 'this location'}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
