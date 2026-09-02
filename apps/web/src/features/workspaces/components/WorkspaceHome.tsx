import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workspace } from '../types/workspace';
import { WorkspaceSelector } from './WorkspaceSelector';
import { WorkspaceManageMenu } from './WorkspaceManageMenu';
import { useWorkspaceContext } from '../context/WorkspaceContext';
import { StorageLocationList } from '../../locations/components/StorageLocationList';
import { ContainerList } from '../../containers/components/ContainerList';
import {
  useStorageLocations,
  useCreateStorageLocation,
  useRenameStorageLocation,
} from '../../locations/hooks/useStorageLocations';
import { useCreateContainer, useContainers } from '../../containers/hooks/useContainers';

import { MobileHomeLayout } from './MobileHomeLayout';

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobile;
}

export interface SearchSuggestion {
  id: string;
  label: string;
  query: string;
}

export const DEFAULT_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { id: 'christmas', label: 'Christmas decor', query: 'Christmas decor' },
  { id: 'camping', label: 'camping gear', query: 'camping gear' },
  { id: 'passports', label: 'passports', query: 'passports' },
];

interface WorkspaceHomeProps {
  activeWorkspace: Workspace;
}

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ activeWorkspace }) => {
  const navigate = useNavigate();
  const workspaceContext = useWorkspaceContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Reset selected location when active workspace changes
  useEffect(() => {
    setSelectedLocationId(null);
  }, [activeWorkspace.id]);

  // Modal visibility states
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [addLocationParentId, setAddLocationParentId] = useState<string | null>(null);
  const [addLocationName, setAddLocationName] = useState('');

  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [addBoxLocationId, setAddBoxLocationId] = useState('');
  const [addBoxName, setAddBoxName] = useState('');
  const [addBoxDesc, setAddBoxDesc] = useState('');

  const [isRenameLocationOpen, setIsRenameLocationOpen] = useState(false);
  const [renameLocationId, setRenameLocationId] = useState<string | null>(null);
  const [renameLocationName, setRenameLocationName] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  // Queries & Mutations
  const { data: locations = [] } = useStorageLocations(activeWorkspace.id);
  const { data: activeContainers = [] } = useContainers(
    activeWorkspace.id,
    selectedLocationId || undefined,
    false
  );
  const createLocationMutation = useCreateStorageLocation(activeWorkspace.id);
  const renameLocationMutation = useRenameStorageLocation(activeWorkspace.id);
  const createBoxMutation = useCreateContainer(activeWorkspace.id);

  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddLocationOpen(false);
        setIsAddBoxOpen(false);
        setIsRenameLocationOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

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

  const handleAddLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!addLocationName.trim()) return;

    try {
      await createLocationMutation.mutateAsync({
        name: addLocationName.trim(),
        parentId: addLocationParentId || null,
      });
      setAddLocationName('');
      setIsAddLocationOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create location.');
    }
  };

  const handleRenameLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!renameLocationId || !renameLocationName.trim()) return;

    try {
      await renameLocationMutation.mutateAsync({
        locationId: renameLocationId,
        data: { name: renameLocationName.trim() },
      });
      setIsRenameLocationOpen(false);
      setRenameLocationId(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to rename location.');
    }
  };

  const handleAddBoxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!addBoxName.trim() || !addBoxLocationId) {
      setFormError('Please fill in the box name and select a storage location.');
      return;
    }

    try {
      const newBox = await createBoxMutation.mutateAsync({
        storageNodeId: addBoxLocationId,
        name: addBoxName.trim(),
        description: addBoxDesc.trim() || undefined,
      });
      setAddBoxName('');
      setAddBoxDesc('');
      setIsAddBoxOpen(false);
      
      if (newBox && newBox.id) {
        navigate(`/workspaces/${activeWorkspace.id}/containers/${newBox.id}`);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create box.');
    }
  };

  const openAddLocationModal = (parentId: string | null = null) => {
    setAddLocationParentId(parentId);
    setAddLocationName('');
    setFormError(null);
    setIsAddLocationOpen(true);
  };

  const openAddBoxModal = () => {
    setAddBoxLocationId(selectedLocationId || '');
    setAddBoxName('');
    setAddBoxDesc('');
    setFormError(null);
    setIsAddBoxOpen(true);
  };

  const openRenameLocationModal = (id: string, currentName: string) => {
    setRenameLocationId(id);
    setRenameLocationName(currentName);
    setFormError(null);
    setIsRenameLocationOpen(true);
  };

  const isMobile = useIsMobile();

  return (
    <>
      {isMobile ? (
        <div className="mobile-page-container" data-layout="mobile">
          <MobileHomeLayout
            activeWorkspace={activeWorkspace}
            workspaces={workspaceContext?.workspaces || [activeWorkspace]}
            locations={locations}
            containers={activeContainers}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
            onSelectWorkspace={(newId) => {
              setSelectedLocationId(null);
              workspaceContext?.setActiveWorkspaceId(newId);
            }}
            onCreateWorkspace={workspaceContext?.openCreateWorkspaceModal || (() => {})}
            onOpenAddLocation={openAddLocationModal}
            onOpenAddBox={openAddBoxModal}
          />
        </div>
      ) : (
        <div className="app-container" style={{ padding: '1rem' }} data-layout="desktop">
          {/* Search Hero Area */}
          <section className="search-hero">
        <h1 className="search-hero__title">
          Where is it?
        </h1>
        <p className="search-hero__subtitle">
          Find anything you've stored.
        </p>
        
        <form onSubmit={handleSearchSubmit} className="search-hero__form">
          <div className="search-hero__input-wrapper">
            <span className="search-hero__icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="text"
              className="search-hero__input"
              placeholder="Where are my Christmas lights?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search stored items or boxes"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary search-hero__button"
          >
            Search
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="search-hero__suggestions">
          <span className="search-hero__suggestions-label">Try searching:</span>
          <div className="search-hero__chips">
            {DEFAULT_SEARCH_SUGGESTIONS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="search-hero__chip"
                onClick={() => handleSuggestionClick(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Browse Columns */}
      <div className="home-grid">
        {/* Left Column: Cohesive Browse Storage Panel */}
        <div className="card browse-storage-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', backgroundColor: 'var(--color-card-bg, #ffffff)', borderRadius: '0.75rem', border: '1px solid var(--color-card-border, #e2e8f0)', height: 'fit-content' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', margin: '0 0 0.75rem 0' }}>
              Browse Storage
            </h2>
            {/* Storage Space Selector & Management Menu */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative', zIndex: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {workspaceContext?.workspaces && workspaceContext.workspaces.length > 0 && (
                  <WorkspaceSelector
                    workspaces={workspaceContext.workspaces}
                    activeWorkspaceId={activeWorkspace.id}
                    onSelectWorkspace={(newId) => {
                      setSelectedLocationId(null);
                      workspaceContext.setActiveWorkspaceId(newId);
                    }}
                    onCreateWorkspace={workspaceContext.openCreateWorkspaceModal}
                  />
                )}
              </div>
              <WorkspaceManageMenu workspace={activeWorkspace} />
            </div>
          </div>

          {/* Locations Tree Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-subtle, #f1f5f9)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', margin: 0 }}>
                Locations
              </h3>
              {selectedLocationId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedLocationId(null)}
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => openAddLocationModal(null)}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
            >
              + Add Location
            </button>
          </div>

          <StorageLocationList
            workspaceId={activeWorkspace.id}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
            onAddSublocation={(parentId) => openAddLocationModal(parentId)}
            onRenameLocation={(id, name) => openRenameLocationModal(id, name)}
          />
        </div>

        {/* Right Column: Your Boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ContainerList
            workspaceId={activeWorkspace.id}
            selectedLocationId={selectedLocationId}
            onAddBox={openAddBoxModal}
          />
        </div>
      </div>
    </div>
  )}

  {/* Add Location Modal */}
      {isAddLocationOpen && (
        <div className="modal-overlay" onClick={() => setIsAddLocationOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Storage Location</h3>
              <button
                type="button"
                onClick={() => setIsAddLocationOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddLocationSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="auth-error" style={{ marginBottom: '1rem' }}>{formError}</div>
                )}
                <div className="form-group">
                  <label htmlFor="location-name">Location Name</label>
                  <input
                    type="text"
                    id="location-name"
                    placeholder="e.g. Garage, Rack A, Shelf 1"
                    value={addLocationName}
                    onChange={(e) => setAddLocationName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="parent-location">Parent Location</label>
                  <select
                    id="parent-location"
                    value={addLocationParentId || ''}
                    onChange={(e) => setAddLocationParentId(e.target.value || null)}
                  >
                    <option value="">None — Root Location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setIsAddLocationOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn--md">
                  Add Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Location Modal */}
      {isRenameLocationOpen && (
        <div className="modal-overlay" onClick={() => setIsRenameLocationOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rename Location</h3>
              <button
                type="button"
                onClick={() => setIsRenameLocationOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRenameLocationSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="auth-error" style={{ marginBottom: '1rem' }}>{formError}</div>
                )}
                <div className="form-group">
                  <label htmlFor="rename-location-name">Location Name</label>
                  <input
                    type="text"
                    id="rename-location-name"
                    value={renameLocationName}
                    onChange={(e) => setRenameLocationName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setIsRenameLocationOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn--md">
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Box Modal */}
      {isAddBoxOpen && (
        <div className="modal-overlay" onClick={() => setIsAddBoxOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Box</h3>
              <button
                type="button"
                onClick={() => setIsAddBoxOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddBoxSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="auth-error" style={{ marginBottom: '1rem' }}>{formError}</div>
                )}
                <div className="form-group">
                  <label htmlFor="box-name">Box Name</label>
                  <input
                    type="text"
                    id="box-name"
                    placeholder="e.g. Holiday Decorations, Camping Gear"
                    value={addBoxName}
                    onChange={(e) => setAddBoxName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="box-location">Storage Location</label>
                  <select
                    id="box-location"
                    value={addBoxLocationId}
                    onChange={(e) => setAddBoxLocationId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="box-description">Description</label>
                  <textarea
                    id="box-description"
                    placeholder="Optional description..."
                    value={addBoxDesc}
                    onChange={(e) => setAddBoxDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setIsAddBoxOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn--md">
                  Create Box
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
