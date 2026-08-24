import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workspace } from '../types/workspace';
import { StorageLocationList } from '../../locations/components/StorageLocationList';
import { ContainerList } from '../../containers/components/ContainerList';
import {
  useStorageLocations,
  useCreateStorageLocation,
  useRenameStorageLocation,
} from '../../locations/hooks/useStorageLocations';
import { useCreateContainer } from '../../containers/hooks/useContainers';

interface WorkspaceHomeProps {
  activeWorkspace: Workspace;
}

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ activeWorkspace }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

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
      navigate(`/workspaces/${activeWorkspace.id}/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
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
      
      // Optionally navigate to new box detail screen
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

  return (
    <div className="app-container" style={{ padding: '1rem' }}>
      {/* Search Hero Area */}
      <section
        style={{
          textAlign: 'center',
          padding: '1.75rem 1rem 2.25rem 1rem',
          maxWidth: '650px',
          margin: '0 auto 1.5rem auto',
        }}
      >
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}>
          Where is it?
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.25rem 0' }}>
          Find any item, box, or storage location.
        </p>
        
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '0.5rem', backgroundColor: '#ffffff', padding: '0.375rem', border: '1px solid #e2e8f0' }}>
          <input
            type="text"
            placeholder="Search items, boxes, or locations... (e.g. Christmas lights)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '0.625rem 0.875rem',
              border: 'none',
              fontSize: '1rem',
              color: '#0f172a',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '0.625rem 1.25rem' }}
          >
            Search
          </button>
        </form>
      </section>

      {/* Main Browse Columns */}
      <div className="home-grid">
        {/* Left Column: Storage Location Tree */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Storage Locations
              </h2>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '36px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {selectedLocation ? `Boxes in ${selectedLocation.name}` : 'Your Boxes'}
            </h2>
            <button
              type="button"
              className="btn-primary"
              onClick={openAddBoxModal}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
            >
              + Add Box
            </button>
          </div>

          <ContainerList
            workspaceId={activeWorkspace.id}
            selectedLocationId={selectedLocationId}
            onAddBox={openAddBoxModal}
          />
        </div>
      </div>

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
                  className="btn-secondary"
                  onClick={() => setIsAddLocationOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
                  className="btn-secondary"
                  onClick={() => setIsRenameLocationOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
                  className="btn-secondary"
                  onClick={() => setIsAddBoxOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Box
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
