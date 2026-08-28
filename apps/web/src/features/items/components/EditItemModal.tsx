import React, { useState, useEffect } from 'react';
import { Item } from '../types/item';
import { useUpdateItem } from '../hooks/useItems';

interface EditItemModalProps {
  workspaceId: string;
  containerId: string;
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  existingCategories?: string[];
}

const COMMON_CATEGORIES = [
  'Holiday Decor',
  'Electronics',
  'Home',
  'Tools',
  'Kitchen',
  'Clothing',
  'Documents',
  'Toys & Games',
  'Crafts',
  'Outdoor',
];

export const EditItemModal: React.FC<EditItemModalProps> = ({
  workspaceId,
  containerId,
  item,
  isOpen,
  onClose,
  existingCategories = [],
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateItem(workspaceId, containerId);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity);
      setCategory(item.category || '');
      setErrorMessage(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Item name is required.');
      return;
    }
    if (quantity < 1) {
      setErrorMessage('Quantity must be at least 1.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        payload: {
          name: name.trim(),
          quantity,
          category: category.trim() || undefined,
        },
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update item.');
    }
  };

  // Speech-to-Text Voice Input for Item Name
  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setName(transcript);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Combine space-specific and common built-in categories
  const suggestedCategories = Array.from(
    new Set([...existingCategories, ...COMMON_CATEGORIES])
  ).slice(0, 10);

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
      aria-labelledby="edit-item-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="edit-item-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Edit Item
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderLeft: '4px solid #ef4444',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Item Name */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="edit-item-name" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Item Name *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                id="edit-item-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                required
                style={{ flex: 1, padding: '0.625rem', fontSize: '0.95rem' }}
              />
              <button
                type="button"
                onClick={handleVoiceInput}
                style={{
                  backgroundColor: isListening ? '#ef4444' : '#f1f5f9',
                  color: isListening ? '#ffffff' : '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  padding: '0 0.75rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  transition: 'all 150ms ease',
                }}
                title={isListening ? 'Listening...' : 'Voice input'}
              >
                🎙️
              </button>
            </div>
            {isListening && (
              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginTop: '0.25rem', display: 'block' }}>
                🔴 Listening... Speak item name clearly
              </span>
            )}
          </div>

          {/* Quantity */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="edit-item-quantity" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Quantity *
            </label>
            <input
              id="edit-item-quantity"
              type="number"
              min="1"
              max="999"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              required
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.95rem', marginTop: '0.25rem' }}
            />
          </div>

          {/* Category */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="edit-item-category" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Category (Optional)
            </label>
            <input
              id="edit-item-category"
              type="text"
              placeholder="e.g. Holiday Decor, Electronics"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.95rem', marginTop: '0.25rem' }}
            />

            {/* Category Suggestion Pills */}
            <div style={{ marginTop: '0.625rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Suggested Categories
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
                {suggestedCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    style={{
                      backgroundColor: category === cat ? '#0284c7' : '#f1f5f9',
                      color: category === cat ? '#ffffff' : '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '1rem',
                      padding: '0.2rem 0.625rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn--md"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn--md"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
