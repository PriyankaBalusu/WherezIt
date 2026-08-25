import React, { useState, useEffect } from 'react';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; category?: string; quantity: number }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCategory('');
      setQuantity(1);
      setFormError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Item name cannot be empty.');
      return;
    }

    if (quantity < 1) {
      setFormError('Quantity must be 1 or greater.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        category: category.trim() ? category.trim() : undefined,
        quantity,
      });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add item.');
    }
  };

  return (
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
      aria-labelledby="add-item-modal-title"
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 id="add-item-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
            Add Item Manually
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {formError && (
          <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem', display: 'block' }}>
              Item Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Christmas Lights"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem', display: 'block' }}>
              Category
            </label>
            <input
              type="text"
              placeholder="e.g. Holiday Decor"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem', display: 'block' }}>
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setQuantity(isNaN(val) ? 0 : val);
              }}
              style={{ width: '100px', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
