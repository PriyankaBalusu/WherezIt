import React, { useState } from 'react';
import { useItems, useCreateItem, useArchiveItem } from '../hooks/useItems';

interface ItemListProps {
  workspaceId: string;
  containerId: string;
  isContainerArchived?: boolean;
}

export const ItemList: React.FC<ItemListProps> = ({
  workspaceId,
  containerId,
  isContainerArchived = false,
}) => {
  const { data: items, isLoading, error } = useItems(workspaceId, containerId);
  const createItemMutation = useCreateItem(workspaceId, containerId);
  const archiveItemMutation = useArchiveItem(workspaceId, containerId);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isContainerArchived) {
      setFormError('Cannot create an item in an archived container.');
      return;
    }

    if (!name.trim()) {
      setFormError('Item name cannot be empty.');
      return;
    }

    if (quantity < 1) {
      setFormError('Quantity must be 1 or greater.');
      return;
    }

    try {
      await createItemMutation.mutateAsync({ name: name.trim(), quantity });
      setName('');
      setQuantity(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create item');
    }
  };

  const handleArchive = async (itemId: string) => {
    try {
      await archiveItemMutation.mutateAsync(itemId);
    } catch (err: any) {
      alert(err.message || 'Failed to archive item');
    }
  };

  if (isLoading) return <div>Loading items...</div>;
  if (error) return <div role="alert">Error loading items: {(error as Error).message}</div>;

  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Items in Container</h3>

      {formError && (
        <div role="alert" style={{ color: '#e53e3e', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          {formError}
        </div>
      )}

      {!isContainerArchived && (
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Item name (e.g. Christmas Lights)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e0' }}
          />
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setQuantity(isNaN(val) ? 0 : val);
            }}
            style={{ width: '80px', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e0' }}
          />
          <button
            type="submit"
            disabled={createItemMutation.isPending}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3182ce',
              color: 'white',
              borderRadius: '0.25rem',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {createItemMutation.isPending ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}

      {items && items.length === 0 ? (
        <div style={{ color: '#718096', fontStyle: 'italic' }}>No items in this container.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items?.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                borderBottom: '1px solid #edf2f7',
              }}
            >
              <div>
                <span style={{ fontWeight: 500 }}>{item.name}</span>
                <span
                  style={{
                    marginLeft: '0.5rem',
                    backgroundColor: '#edf2f7',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#4a5568',
                  }}
                >
                  Qty: {item.quantity}
                </span>
                {item.isVerified && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      color: '#38a169',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Verified
                  </span>
                )}
              </div>
              <button
                onClick={() => handleArchive(item.id)}
                disabled={archiveItemMutation.isPending}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  borderRadius: '0.25rem',
                  border: 'none',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
