import React, { useState } from 'react';
import { useItems, useCreateItem, useArchiveItem, useRestoreItem, useDeleteItem } from '../hooks/useItems';
import { AddItemModal } from './AddItemModal';
import { EditItemModal } from './EditItemModal';
import { ItemPhotosModal } from './ItemPhotosModal';
import { AddContentsChooserModal } from './AddContentsChooserModal';
import { Item } from '../types/item';

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
  const [showArchived, setShowArchived] = useState(false);
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

  const handleCreate = async (data: { name: string; category?: string; quantity: number }) => {
    if (isContainerArchived) return;
    await createItemMutation.mutateAsync(data);
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
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
          Contents
        </h2>
        {!isContainerArchived && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsChooserOpen(true)}
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.85rem' }}
          >
            + Add Item
          </button>
        )}
      </div>

      {/* Item List */}
      {items && items.length === 0 ? (
        <div style={{ color: '#64748b', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>
          No items in this container.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {activeItems.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{item.name}</span>
                {item.category && (
                  <span
                    style={{
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {item.category}
                  </span>
                )}
                <span
                  style={{
                    backgroundColor: '#f1f5f9',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#475569',
                    fontWeight: 500,
                  }}
                >
                  Qty: {item.quantity}
                </span>
              </div>

              {!isContainerArchived && (
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button
                    type="button"
                    onClick={() => setPhotosItem(item)}
                    style={{
                      padding: '0.25rem 0.625rem',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      borderRadius: '0.25rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🖼️ Photos
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    style={{
                      padding: '0.25rem 0.625rem',
                      backgroundColor: '#ffffff',
                      color: '#0284c7',
                      borderRadius: '0.25rem',
                      border: '1px solid #bae6fd',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemToArchive({ id: item.id, name: item.name })}
                    disabled={archiveItemMutation.isPending}
                    style={{
                      padding: '0.25rem 0.625rem',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      borderRadius: '0.25rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Archive
                  </button>
                </div>
              )}
            </li>
          ))}

          {/* Archived Items Section when toggle is on */}
          {showArchived && archivedItems.length > 0 && (
            <>
              <li style={{ padding: '0.75rem 0 0.25rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Archived Items
              </li>
              {archivedItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.625rem 0.5rem',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: '#f8fafc',
                    opacity: 0.8,
                    borderRadius: '0.25rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#64748b', fontSize: '0.9rem', textDecoration: 'line-through' }}>{item.name}</span>
                    {item.category && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          backgroundColor: '#e2e8f0',
                          color: '#64748b',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        {item.category}
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                      }}
                    >
                      Qty: {item.quantity}
                    </span>
                  </div>

                  {!isContainerArchived && (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        type="button"
                        onClick={() => handleRestore(item.id)}
                        disabled={restoreItemMutation.isPending}
                        className="btn-secondary"
                        style={{
                          padding: '0.25rem 0.625rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete({ id: item.id, name: item.name })}
                        disabled={deleteItemMutation.isPending}
                        style={{
                          padding: '0.25rem 0.625rem',
                          backgroundColor: '#fff',
                          color: '#dc2626',
                          borderRadius: '0.25rem',
                          border: '1px solid #fca5a5',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
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
      )}

      {/* Show Archived Toggle */}
      <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived Items
        </label>
      </div>

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
        isSubmitting={createItemMutation.isPending}
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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
            style={{
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 id="archive-item-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: '#0f172a', fontWeight: 700 }}>
              Archive item?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.5rem', marginTop: 0 }}>
              This item will be hidden from active box contents. You can restore it later.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setItemToArchive(null)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmArchive}
                disabled={archiveItemMutation.isPending}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
            style={{
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 id="delete-item-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: '#dc2626', fontWeight: 700 }}>
              Delete this item permanently?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.5rem', marginTop: 0 }}>
              This permanently removes this item from WherezIt. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setItemToDelete(null)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleteItemMutation.isPending}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
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
