import React, { useState, useEffect, useRef } from 'react';
import {
  useStorageLocations,
  useDeleteStorageLocation,
  useMoveStorageLocation,
} from '../hooks/useStorageLocations';

interface StorageLocationListProps {
  workspaceId: string;
  selectedLocationId?: string | null;
  onSelectLocation?: (id: string | null) => void;
  onAddSublocation?: (parentId: string) => void;
  onRenameLocation?: (id: string, name: string) => void;
}

export const StorageLocationList: React.FC<StorageLocationListProps> = ({
  workspaceId,
  selectedLocationId = null,
  onSelectLocation,
  onAddSublocation,
  onRenameLocation,
}) => {
  const { data: locations = [], isLoading, isError, error, refetch } = useStorageLocations(workspaceId);
  const deleteMutation = useDeleteStorageLocation(workspaceId);
  const moveMutation = useMoveStorageLocation(workspaceId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (isLoading) {
    return <div style={{ color: '#64748b', padding: '1rem' }}>Loading storage locations...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: '#dc2626', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fca5a5' }}>
        <p>Error loading locations: {(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn-secondary" style={{ marginTop: '0.5rem' }}>Retry</button>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      if (selectedLocationId === id && onSelectLocation) {
        onSelectLocation(null);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete location.');
    }
  };

  const handleMove = async (id: string, targetParentId: string | null) => {
    setActionError(null);
    try {
      await moveMutation.mutateAsync({ locationId: id, data: { parentId: targetParentId } });
    } catch (err: any) {
      setActionError(err.message || 'Failed to move location.');
    }
  };

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const nodes = locations.filter((loc) => loc.parentId === parentId);
    if (nodes.length === 0) return null;

    return (
      <ul style={{ listStyleType: 'none', paddingLeft: depth === 0 ? 0 : '1rem', marginTop: '0.25rem', borderLeft: depth > 0 ? '1px dashed #cbd5e1' : 'none' }}>
        {nodes.map((node) => {
          const isSelected = selectedLocationId === node.id;
          const isMenuOpen = activeMenuId === node.id;

          return (
            <li key={node.id} style={{ marginBottom: '0.375rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.625rem',
                  borderRadius: '0.375rem',
                  backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
                  border: isSelected ? '1px solid #bae6fd' : '1px solid transparent',
                  transition: 'background-color 150ms ease',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectLocation?.(isSelected ? null : node.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: 'none',
                    border: 'none',
                    color: isSelected ? '#0369a1' : '#0f172a',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    flex: 1,
                    padding: 0,
                  }}
                >
                  <span>{depth === 0 ? '🏠' : depth === 1 ? '🗄️' : '📁'}</span>
                  <span>{node.name}</span>
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    aria-label="Location actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : node.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      fontSize: '1rem',
                    }}
                  >
                    ⋯
                  </button>

                  {isMenuOpen && (
                    <div
                      ref={menuRef}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        zIndex: 100,
                        minWidth: '150px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        padding: '0.25rem 0',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onAddSublocation?.(node.id);
                          setActiveMenuId(null);
                        }}
                        style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}
                      >
                        + Sub-location
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRenameLocation?.(node.id, node.name);
                          setActiveMenuId(null);
                        }}
                        style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}
                      >
                        Rename
                      </button>
                      {node.parentId !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            handleMove(node.id, null);
                            setActiveMenuId(null);
                          }}
                          style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}
                        >
                          Move to Root
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(node.id);
                          setActiveMenuId(null);
                        }}
                        style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: '#dc2626', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {renderTree(node.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="card" style={{ padding: '1rem' }}>
      {actionError && (
        <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef2f2', borderRadius: '0.375rem', border: '1px solid #fca5a5', fontSize: '0.8rem' }}>
          {actionError}
        </div>
      )}

      {/* Hierarchy Tree */}
      {locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
          No storage locations yet.
        </div>
      ) : (
        <div>
          {renderTree(null, 0)}
        </div>
      )}
    </div>
  );
};

