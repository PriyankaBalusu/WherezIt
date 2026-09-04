import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import { useItems, useCreateItem, useArchiveItem, useRestoreItem, useDeleteItem } from '../hooks/useItems';
import { uploadItemImage } from '../api/itemApi';
import { AddItemModal } from './AddItemModal';
import { EditItemModal } from './EditItemModal';
import { ItemPhotosModal } from './ItemPhotosModal';
import { AddContentsChooserModal } from './AddContentsChooserModal';
import { Item } from '../types/item';
import { getItemIconAndStyle } from '../utils/getItemIcon';

interface ItemListProps {
  workspaceId: string;
  containerId: string;
  isContainerArchived?: boolean;
  onAddFromPhoto?: () => void;
}

export const ItemList: React.FC<ItemListProps> = ({
  workspaceId,
  containerId,
  isContainerArchived = false,
  onAddFromPhoto,
}) => {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isContentsMenuOpen, setIsContentsMenuOpen] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const contentsMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (!isContentsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contentsMenuRef.current && !contentsMenuRef.current.contains(e.target as Node)) {
        setIsContentsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsContentsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isContentsMenuOpen]);

  const [showArchived, setShowArchived] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: items, isLoading, error } = useItems(workspaceId, containerId, showArchived);

  const createItemMutation = useCreateItem(workspaceId, containerId);
  const archiveItemMutation = useArchiveItem(workspaceId, containerId);
  const restoreItemMutation = useRestoreItem(workspaceId, containerId);
  const deleteItemMutation = useDeleteItem(workspaceId, containerId);

  // Modals state
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [photosItem, setPhotosItem] = useState<Item | null>(null);
  const [itemToArchive, setItemToArchive] = useState<{ id: string; name: string } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const defaultLimit = isDesktop ? 10 : 5;

  const handleCreate = async (data: { name: string; category?: string; quantity: number; photoFile?: File | null }) => {
    if (isContainerArchived) return;
    setIsAddingItem(true);
    try {
      const newItem = await createItemMutation.mutateAsync({
        name: data.name,
        category: data.category,
        quantity: data.quantity,
      });

      if (data.photoFile && newItem && newItem.id) {
        try {
          const token = await getIdToken();
          if (token) {
            await uploadItemImage(workspaceId, newItem.id, data.photoFile, token);
          }
        } catch {
          alert('Item added successfully, but photo upload failed. You can add a photo later using the camera icon.');
        }
      }
    } finally {
      setIsAddingItem(false);
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['containers', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['boxHistory', workspaceId, containerId] });
    }
  };

  const handleConfirmArchive = async () => {
    if (!itemToArchive) return;
    try {
      await archiveItemMutation.mutateAsync(itemToArchive.id);
      setItemToArchive(null);
    } catch (err: any) {
      alert(err.message || 'Failed to archive item.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteItemMutation.mutateAsync(itemToDelete.id);
      setItemToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete item permanently.');
    }
  };

  const handleRestore = async (itemId: string) => {
    try {
      await restoreItemMutation.mutateAsync(itemId);
    } catch (err: any) {
      alert(err.message || 'Failed to restore item.');
    }
  };

  if (isLoading) return <div style={{ color: '#64748b', padding: '1rem 0' }}>Loading items...</div>;
  if (error) return <div role="alert" style={{ color: '#dc2626', padding: '1rem 0' }}>Error loading items: {(error as Error).message}</div>;

  const activeItems = items?.filter((item) => !item.isArchived) || [];
  const archivedItems = items?.filter((item) => item.isArchived) || [];
  const existingCategories = Array.from(new Set(items?.map((i) => i.category).filter(Boolean) as string[]));

  return (
    <div className="card item-list-card" style={{ marginBottom: '1.5rem' }}>
      {/* Header */}
      <div className="item-list-header">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--color-text, #0f172a)' }}>
            Contents
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
            Items stored in this box.
          </p>
        </div>
        <div className="item-list-header-actions" ref={contentsMenuRef}>
          {!isContainerArchived && (
            <button
              type="button"
              className="btn btn-primary btn--md"
              onClick={() => setIsChooserOpen(true)}
            >
              + Add Item
            </button>
          )}
          <button
            type="button"
            aria-label="Contents display options"
            className="btn btn-secondary btn--icon-md"
            onClick={() => setIsContentsMenuOpen(!isContentsMenuOpen)}
          >
            ⋮
          </button>
          {isContentsMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.375rem',
                width: '180px',
                backgroundColor: 'var(--color-dropdown-bg, #ffffff)',
                borderRadius: '0.5rem',
                boxShadow: 'var(--color-card-shadow, 0 10px 25px rgba(0,0,0,0.15))',
                border: '1px solid var(--color-dropdown-border, #e2e8f0)',
                zIndex: 40,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowArchived(!showArchived);
                  setIsContentsMenuOpen(false);
                }}
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--color-text, #0f172a)',
                  cursor: 'pointer',
                }}
              >
                {showArchived ? 'Hide archived items' : 'Show archived items'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Item List */}
      {items && items.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted, #64748b)', fontStyle: 'italic', padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--color-bg-subtle, #f8fafc)', borderRadius: '0.5rem', border: '1px dashed var(--color-border, #cbd5e1)' }}>
          No items in this box yet. Click "+ Add Item" to add items.
        </div>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(isExpanded ? activeItems : activeItems.slice(0, defaultLimit)).map((item) => {
              const { icon, bg, border } = getItemIconAndStyle(item.name, item.category);

              return (
                <li
                  key={item.id}
                  className="item-list-row"
                >
                  <div className="item-list-item-info">
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '0.5rem',
                        backgroundColor: bg,
                        border: `1px solid ${border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)', fontSize: '0.95rem', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                        {item.name}
                      </div>
                      {item.category && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 500, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {item.category}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="item-list-item-actions">
                    <span
                      style={{
                        height: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--color-bg-subtle, #f1f5f9)',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        padding: '0 0.625rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                        color: 'var(--color-text, #334155)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                      }}
                    >
                      Qty: {item.quantity}
                    </span>

                    {!isContainerArchived && (
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn--icon-sm"
                          onClick={() => setPhotosItem(item)}
                          title="Item Photos"
                        >
                          📷
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn--icon-sm"
                          onClick={() => setEditingItem(item)}
                          title="Edit Item"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn--icon-sm"
                          onClick={() => setItemToArchive({ id: item.id, name: item.name })}
                          disabled={archiveItemMutation.isPending}
                          title="Archive Item"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}

            {/* Archived Items Section when toggle is on */}
            {showArchived && archivedItems.length > 0 && (
              <>
                <li style={{ padding: '0.75rem 0 0.25rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Archived Items
                </li>
                {archivedItems.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem 0.875rem',
                      padding: '0.75rem 0.5rem',
                      borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)',
                      opacity: 0.75,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-muted, #64748b)', textDecoration: 'line-through', fontSize: '0.9rem' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)' }}>
                        Qty: {item.quantity} {item.category ? `• ${item.category}` : ''}
                      </div>
                    </div>

                    {!isContainerArchived && (
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRestore(item.id)}
                          disabled={restoreItemMutation.isPending}
                          className="btn btn-secondary btn--sm"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ id: item.id, name: item.name })}
                          disabled={deleteItemMutation.isPending}
                          className="btn btn-danger btn--sm"
                        >
                          Delete Permanently
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </>
            )}
          </ul>

          {activeItems.length > defaultLimit && (
            <div style={{ marginTop: '0.875rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary-text, #0284c7)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                }}
              >
                {isExpanded
                  ? `Showing all ${activeItems.length} items · Show fewer`
                  : `View all ${activeItems.length} items`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Chooser Modal */}
      <AddContentsChooserModal
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        onSelectManual={() => setIsAddModalOpen(true)}
        onSelectPhoto={() => {
          if (onAddFromPhoto) {
            onAddFromPhoto();
          } else {
            alert('Upload photo for AI processing using Box Actions or upload input.');
          }
        }}
      />

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isAddingItem || createItemMutation.isPending}
      />

      {/* Edit Item Modal */}
      {editingItem && (
        <EditItemModal
          workspaceId={workspaceId}
          containerId={containerId}
          item={editingItem}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          existingCategories={existingCategories}
        />
      )}

      {/* Item Photos Modal */}
      {photosItem && (
        <ItemPhotosModal
          workspaceId={workspaceId}
          itemId={photosItem.id}
          itemName={photosItem.name}
          isOpen={!!photosItem}
          onClose={() => setPhotosItem(null)}
        />
      )}

      {/* Archive Item Confirmation Modal */}
      {itemToArchive && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--color-modal-overlay, rgba(0, 0, 0, 0.5))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-item-modal-title"
        >
          <div
            className="archive-item-modal-dialog modal-surface"
            style={{
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%',
            }}
          >
            <h3 id="archive-item-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: 'var(--color-text, #0f172a)', fontWeight: 700 }}>
              Archive item?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #475569)', marginBottom: '1.5rem', marginTop: 0 }}>
              This item will be hidden from active box contents. You can restore it later.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setItemToArchive(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                onClick={handleConfirmArchive}
                disabled={archiveItemMutation.isPending}
              >
                {archiveItemMutation.isPending ? 'Archiving...' : 'Archive Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {itemToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--color-modal-overlay, rgba(0, 0, 0, 0.5))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-modal-title"
        >
          <div
            className="delete-item-modal-dialog modal-surface"
            style={{
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%',
            }}
          >
            <h3 id="delete-item-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: 'var(--color-danger, #dc2626)', fontWeight: 700 }}>
              Delete this item permanently?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #475569)', marginBottom: '1.5rem', marginTop: 0 }}>
              This permanently removes this item from WherezIt. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setItemToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn--md"
                onClick={handleConfirmDelete}
                disabled={deleteItemMutation.isPending}
              >
                {deleteItemMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
