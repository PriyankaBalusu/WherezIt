import React, { useState, useEffect } from 'react';
import { useCaptureReview } from '../hooks/useCaptureReview';

export interface DraftItem {
  id: string; // suggestion ID or client temp ID
  name: string;
  quantity: number;
  isCustomAdd?: boolean;
}

interface CaptureReviewScreenProps {
  workspaceId: string;
  captureId: string;
  onNavigateToManualEntry?: (containerId: string) => void;
}

export const CaptureReviewScreen: React.FC<CaptureReviewScreenProps> = ({
  workspaceId,
  captureId,
  onNavigateToManualEntry,
}) => {
  const { data: reviewData, isLoading, isError, error } = useCaptureReview(workspaceId, captureId);

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);

  // Initialize draft items from server suggestions when review data loads
  useEffect(() => {
    if (reviewData?.suggestions) {
      setDraftItems(
        reviewData.suggestions.map((s) => ({
          id: s.id,
          name: s.suggestedName,
          quantity: s.suggestedQuantity,
        }))
      );
    }
  }, [reviewData]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#4a5568' }}>
        Loading AI capture review...
      </div>
    );
  }

  if (isError || !reviewData) {
    return (
      <div role="alert" style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '1rem', borderRadius: '0.375rem', maxWidth: '600px', margin: '2rem auto' }}>
        {error?.message || 'Failed to load capture review.'}
      </div>
    );
  }

  // 1. Status == PROCESSING
  if (reviewData.status === 'PROCESSING') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#ebf8ff', borderRadius: '0.5rem', maxWidth: '600px', margin: '2rem auto' }}>
        <h3 style={{ color: '#2b6cb0', marginTop: 0 }}>AI Processing in Progress</h3>
        <p style={{ color: '#4a5568' }}>
          Photo processing for container <strong>{reviewData.boxDisplayId}</strong> is still underway. Please check back shortly.
        </p>
      </div>
    );
  }

  // 2. Status == FAILED
  if (reviewData.status === 'FAILED') {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '0.5rem', maxWidth: '600px', margin: '2rem auto' }}>
        <h3 style={{ color: '#c53030', marginTop: 0 }}>AI Processing Failed</h3>
        <p style={{ color: '#4a5568' }}>
          {reviewData.failureReason || 'AI was unable to detect items in this photo.'}
        </p>
        {onNavigateToManualEntry && (
          <button
            type="button"
            onClick={() => onNavigateToManualEntry(reviewData.containerId)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e53e3e',
              color: '#fff',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Go to Manual Item Entry for {reviewData.boxDisplayId}
          </button>
        )}
      </div>
    );
  }

  const isReadOnly = reviewData.status === 'CONFIRMED';
  const imageUrl = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/images/${encodeURIComponent(reviewData.imageId)}`;

  const handleNameChange = (id: string, newName: string) => {
    if (isReadOnly) return;
    setDraftItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: newName } : item))
    );
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    if (isReadOnly) return;
    const qty = Math.max(1, newQty);
    setDraftItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
    );
  };

  const handleRemove = (id: string) => {
    if (isReadOnly) return;
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddMissingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    const newItem: DraftItem = {
      id: `draft-add-${Date.now()}`,
      name: trimmed,
      quantity: Math.max(1, newItemQuantity),
      isCustomAdd: true,
    };

    setDraftItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemQuantity(1);
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1a202c' }}>
          {isReadOnly ? 'Confirmed Container Photo' : 'Review AI Suggestions'}
        </h2>
        <div style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.25rem' }}>
          Container: <strong>{reviewData.boxDisplayId}</strong>
          {reviewData.breadcrumbDisplay && ` • ${reviewData.breadcrumbDisplay}`}
        </div>
      </div>

      {/* Authorized Image Preview */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <img
          src={imageUrl}
          alt={`Container ${reviewData.boxDisplayId}`}
          style={{
            maxWidth: '100%',
            maxHeight: '300px',
            borderRadius: '0.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            objectFit: 'cover',
          }}
        />
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#2d3748' }}>
          Detected Items Draft ({draftItems.length})
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1rem' }}>
          Review suggested names and quantities before confirming inventory.
        </p>

        {draftItems.length === 0 ? (
          <div style={{ padding: '1rem', backgroundColor: '#f7fafc', borderRadius: '0.375rem', textAlign: 'center', color: '#a0aec0' }}>
            No items in current review draft.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {draftItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: '#f7fafc',
                  border: '1px solid #edf2f7',
                  borderRadius: '0.375rem',
                }}
              >
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleNameChange(item.id, e.target.value)}
                  disabled={isReadOnly}
                  aria-label="Item name"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '0.25rem',
                    fontSize: '0.95rem',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    disabled={isReadOnly || item.quantity <= 1}
                    aria-label="Decrease quantity"
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#e2e8f0',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: isReadOnly || item.quantity <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    -
                  </button>
                  <span style={{ minWidth: '2rem', textAlign: 'center', fontWeight: 600 }}>
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    disabled={isReadOnly}
                    aria-label="Increase quantity"
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#e2e8f0',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    aria-label="Remove item"
                    style={{
                      padding: '0.35rem 0.65rem',
                      backgroundColor: '#fff5f5',
                      color: '#c53030',
                      border: '1px solid #feb2b2',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add missing item draft form */}
        {!isReadOnly && (
          <form onSubmit={handleAddMissingItem} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #edf2f7', paddingTop: '1rem' }}>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add missing item name..."
              aria-label="Missing item name"
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '0.25rem' }}
            />
            <input
              type="number"
              min={1}
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
              style={{ width: '60px', padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '0.25rem' }}
              aria-label="Missing item quantity"
            />
            <button
              type="submit"
              disabled={!newItemName.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: !newItemName.trim() ? '#cbd5e0' : '#38a169',
                color: '#fff',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: !newItemName.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              + Add Item
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
