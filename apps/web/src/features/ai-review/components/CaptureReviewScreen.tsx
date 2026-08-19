import React, { useState, useEffect } from 'react';
import { useCaptureReview } from '../hooks/useCaptureReview';
import { confirmCaptureReview, ConfirmItemPayload } from '../api/captureReviewApi';

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
  onConfirmSuccess?: (containerId: string) => void;
}

export const CaptureReviewScreen: React.FC<CaptureReviewScreenProps> = ({
  workspaceId,
  captureId,
  onNavigateToManualEntry,
  onConfirmSuccess,
}) => {
  const { data: reviewData, isLoading, isError, error, refetch } = useCaptureReview(workspaceId, captureId);

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

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
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
        Loading AI capture review...
      </div>
    );
  }

  if (isError || !reviewData) {
    return (
      <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', maxWidth: '600px', margin: '2rem auto' }}>
        {error?.message || 'Failed to load capture review.'}
      </div>
    );
  }

  // 1. Status == PROCESSING
  if (reviewData.status === 'PROCESSING') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#e0f2fe', borderRadius: '0.75rem', maxWidth: '600px', margin: '2rem auto', border: '1px solid #7dd3fc' }}>
        <h3 style={{ color: '#0369a1', marginTop: 0 }}>AI Processing in Progress</h3>
        <p style={{ color: '#0c4a6e' }}>
          Photo processing for container <strong>{reviewData.boxDisplayId}</strong> is still underway. Please check back shortly.
        </p>
      </div>
    );
  }

  // 2. Status == FAILED
  if (reviewData.status === 'FAILED') {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.75rem', maxWidth: '600px', margin: '2rem auto' }}>
        <h3 style={{ color: '#dc2626', marginTop: 0 }}>AI Processing Failed</h3>
        <p style={{ color: '#7f1d1d', marginBottom: '1.5rem' }}>
          {reviewData.failureReason || 'AI was unable to detect items in this photo.'}
        </p>
        {onNavigateToManualEntry && (
          <button
            type="button"
            className="btn-danger"
            onClick={() => onNavigateToManualEntry(reviewData.containerId)}
          >
            Go to Manual Item Entry for {reviewData.boxDisplayId}
          </button>
        )}
      </div>
    );
  }

  const isReadOnly = reviewData.status === 'CONFIRMED' || confirmedSuccess;
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

  const handleConfirmSubmission = async () => {
    if (isReadOnly || isSubmittingConfirm) return;
    if (draftItems.length === 0) {
      setConfirmError('Please keep or add at least one item before confirming.');
      return;
    }

    try {
      setIsSubmittingConfirm(true);
      setConfirmError(null);

      const itemsPayload: ConfirmItemPayload[] = draftItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        suggestionId: item.isCustomAdd ? undefined : item.id,
      }));

      await confirmCaptureReview(workspaceId, captureId, itemsPayload);
      setConfirmedSuccess(true);
      setIsSubmittingConfirm(false);
      refetch();

      if (onConfirmSuccess) {
        onConfirmSuccess(reviewData.containerId);
      }
    } catch (err: any) {
      setIsSubmittingConfirm(false);
      setConfirmError(err.message || 'Confirmation failed. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.75rem', fontWeight: 800 }}>
            {isReadOnly ? 'Confirmed Container Photo' : 'Review AI Suggestions'}
          </h2>
          {!isReadOnly && <span className="badge badge-ai-suggested">✨ AI Suggested</span>}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
          Container: <strong style={{ color: '#0f172a' }}>{reviewData.boxDisplayId}</strong>
          {reviewData.breadcrumbDisplay && ` • 📍 ${reviewData.breadcrumbDisplay}`}
        </div>
      </div>

      {confirmError && (
        <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {confirmError}
        </div>
      )}

      {confirmedSuccess && (
        <div role="status" style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontWeight: 600 }}>
          ✓ Inventory confirmed successfully! Trusted items have been created for container {reviewData.boxDisplayId}.
        </div>
      )}

      {/* Flagship Two-Column Review Composition */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Authorized Image Preview */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src={imageUrl}
            alt={`Container ${reviewData.boxDisplayId}`}
            style={{
              maxWidth: '100%',
              maxHeight: '380px',
              borderRadius: '0.5rem',
              objectFit: 'cover',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>
            Uploaded Container Photo
          </span>
        </div>

        {/* Right Column: AI Suggestions Review Draft */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
            Detected Items Draft ({draftItems.length})
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Review and adjust AI-suggested items before explicit confirmation.
          </p>

          {draftItems.length === 0 ? (
            <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1' }}>
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
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
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
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={isReadOnly || item.quantity <= 1}
                      aria-label="Decrease quantity"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      -
                    </button>
                    <span style={{ minWidth: '2rem', textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={isReadOnly}
                      aria-label="Increase quantity"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      +
                    </button>
                  </div>

                  {!isReadOnly && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleRemove(item.id)}
                      aria-label="Remove item"
                      style={{ padding: '0.35rem 0.65rem', color: '#dc2626', fontSize: '0.75rem' }}
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
            <form onSubmit={handleAddMissingItem} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add missing item name..."
                aria-label="Missing item name"
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem' }}
              />
              <input
                type="number"
                min={1}
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
                style={{ width: '60px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                aria-label="Missing item quantity"
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={!newItemName.trim()}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                + Add Item
              </button>
            </form>
          )}

          {/* Action Confirm Button */}
          {!isReadOnly && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmSubmission}
                disabled={draftItems.length === 0 || isSubmittingConfirm}
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
              >
                {isSubmittingConfirm ? 'Confirming Inventory...' : 'Confirm Inventory'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
