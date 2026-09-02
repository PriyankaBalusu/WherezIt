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
  readOnly?: boolean;
}

export const StorageLocationList: React.FC<StorageLocationListProps> = ({
  workspaceId,
  selectedLocationId = null,
  onSelectLocation,
  onAddSublocation,
  onRenameLocation,
  readOnly = false,
}) => {
  const { data: locations = [], isLoading, isError, error, refetch } = useStorageLocations(workspaceId);
  const deleteMutation = useDeleteStorageLocation(workspaceId);
  const moveMutation = useMoveStorageLocation(workspaceId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  const menuRef = useRef<HTMLDivElement | null>(null);

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
    return <div style={{ color: '#64748b', padding: '0.75rem 0' }}>Loading storage locations...</div>;
  }

  if (isError) {
    return (
      <div style={{ color: '#dc2626', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fca5a5' }}>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>Error loading locations: {(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Retry</button>
      </div>
    );
  }

  const toggleNodeExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
      <ul
        style={{
          listStyleType: 'none',
          paddingLeft: depth === 0 ? 0 : '0.875rem',
          marginTop: '0.25rem',
          marginBottom: 0,
          borderLeft: depth > 0 ? '2px solid #e2e8f0' : 'none',
          marginLeft: depth > 0 ? '0.5rem' : 0,
        }}
      >
        {nodes.map((node) => {
          const isSelected = selectedLocationId === node.id;
          const isMenuOpen = activeMenuId === node.id;
          const children = locations.filter((l) => l.parentId === node.id);
          const hasChildren = children.length > 0;
          const isCollapsed = collapsedNodeIds.has(node.id);

          return (
            <li key={node.id} style={{ marginBottom: '0.25rem' }}>
              <div
                className={`location-tree-row ${isSelected ? 'location-tree-row--selected' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
                      onClick={(e) => toggleNodeExpand(node.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '0 0.25rem',
                        fontSize: '0.75rem',
                        userSelect: 'none',
                      }}
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span style={{ width: '1rem', display: 'inline-block' }} />
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectLocation?.(isSelected ? null : node.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      background: 'none',
                      border: 'none',
                      color: isSelected ? 'var(--color-primary-text, #0369a1)' : 'var(--color-text, #0f172a)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      flex: 1,
                      padding: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{depth === 0 ? '🏠' : depth === 1 ? '🗄️' : '📁'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                  </button>
                </div>

                {!readOnly && (
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
                        color: 'var(--color-text-muted, #64748b)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        fontSize: '0.9rem',
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
                          backgroundColor: 'var(--color-dropdown-bg, #ffffff)',
                          border: '1px solid var(--color-dropdown-border, #cbd5e1)',
                          borderRadius: '0.375rem',
                          boxShadow: 'var(--color-card-shadow, 0 4px 6px rgba(0,0,0,0.1))',
                          padding: '0.25rem 0',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onAddSublocation?.(node.id);
                            setActiveMenuId(null);
                          }}
                          style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-text, #334155)', cursor: 'pointer' }}
                        >
                          + Sub-location
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRenameLocation?.(node.id, node.name);
                            setActiveMenuId(null);
                          }}
                          style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-text, #334155)', cursor: 'pointer' }}
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
                            style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-text, #334155)', cursor: 'pointer' }}
                          >
                            Make Root Location
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleDelete(node.id);
                            setActiveMenuId(null);
                          }}
                          style={{ display: 'block', width: '100%', padding: '0.375rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-danger, #dc2626)', cursor: 'pointer' }}
                        >
                          Delete Location
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {hasChildren && !isCollapsed && renderTree(node.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div>
      {actionError && (
        <div style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.8rem', marginBottom: '0.5rem', padding: '0.375rem 0.5rem', backgroundColor: 'var(--color-danger-bg, #fef2f2)', borderRadius: '0.25rem' }}>
          {actionError}
        </div>
      )}
      {locations.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
          {readOnly ? 'No storage locations found.' : 'No locations added yet. Click "+ Add Location" to create one.'}
        </div>
      ) : (
        renderTree(null, 0)
      )}
    </div>
  );
};
