import React, { useState, useEffect } from 'react';
import { useCaptureReview } from '../hooks/useCaptureReview';
import { confirmCaptureReview, ConfirmItemPayload } from '../api/captureReviewApi';
import { useAuth } from '../../auth/useAuth';
import './CaptureReviewScreen.css';

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
  const { getIdToken } = useAuth();
  const { data: reviewData, isLoading, isError, error, refetch } = useCaptureReview(workspaceId, captureId);

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);

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

  // Fetch image blob with authorization header
  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function fetchImageBlob() {
      if (!reviewData?.imageId) return;

      setIsImageLoading(true);
      try {
        const token = await getIdToken();
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
        const imageUrl = `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/images/${encodeURIComponent(reviewData.imageId!)}`;

        const response = await fetch(imageUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.statusText}`);
        }

        const blob = await response.blob();
        if (isMounted) {
          createdUrl = URL.createObjectURL(blob);
          setImageBlobUrl(createdUrl);
        }
      } catch (err) {
        console.error('Error loading capture image blob:', err);
      } finally {
        if (isMounted) {
          setIsImageLoading(false);
        }
      }
    }

    fetchImageBlob();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [reviewData?.imageId, workspaceId, getIdToken]);

  if (isLoading) {
    return (
      <div className="capture-review-loading-state">
        <div className="spinner" />
        <span>Loading AI capture review...</span>
      </div>
    );
  }

  if (isError || !reviewData) {
    return (
      <div role="alert" className="capture-review-error-state">
        {error?.message || 'Failed to load capture review.'}
      </div>
    );
  }

  // 1. Status == PROCESSING
  if (reviewData.status === 'PROCESSING') {
    return (
      <div className="capture-review-processing-state">
        <h3>AI Processing in Progress</h3>
        <p>
          Photo processing for container <strong>{reviewData.boxDisplayId}</strong> is still underway. Please check back shortly.
        </p>
      </div>
    );
  }

  // 2. Status == FAILED
  if (reviewData.status === 'FAILED') {
    return (
      <div className="capture-review-failed-state">
        <h3>AI Processing Failed</h3>
        <p>
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
    <div className="capture-review-container">
      <div className="capture-review-header">
        <div className="capture-review-title-row">
          <h2 className="capture-review-title">
            {isReadOnly ? 'Confirmed Container Photo' : 'Review AI Suggestions'}
          </h2>
          {!isReadOnly && <span className="badge badge-ai-suggested">✨ AI Suggested</span>}
        </div>
        <div className="capture-review-breadcrumb">
          Container: <strong>{reviewData.boxDisplayId}</strong>
          {reviewData.breadcrumbDisplay && ` • 📍 ${reviewData.breadcrumbDisplay}`}
        </div>
      </div>

      {confirmError && (
        <div role="alert" className="capture-review-error">
          {confirmError}
        </div>
      )}

      {confirmedSuccess && (
        <div role="status" className="capture-review-success">
          ✓ Inventory confirmed successfully! Trusted items have been created for container {reviewData.boxDisplayId}.
        </div>
      )}

      <div className="capture-review-grid">
        <div className="card capture-review-image-card">
          {isImageLoading ? (
            <div className="capture-review-loading">
              <div className="spinner" />
              📷 Loading photo preview...
            </div>
          ) : imageBlobUrl ? (
            <img
              src={imageBlobUrl}
              alt={`Container ${reviewData.boxDisplayId}`}
              className="capture-review-photo"
            />
          ) : (
            <div className="capture-review-no-photo">
              <div className="capture-review-no-photo-icon">🖼️</div>
              <div className="capture-review-no-photo-text">Photo preview unavailable</div>
            </div>
          )}
          <span className="capture-review-photo-label">
            Uploaded Container Photo
          </span>
        </div>

        <div className="card capture-review-draft-card">
          <h3 className="capture-review-draft-title">
            Detected Items Draft ({draftItems.length})
          </h3>
          <p className="capture-review-draft-subtitle">
            Review and adjust AI-suggested items before explicit confirmation.
          </p>

          {draftItems.length === 0 ? (
            <div className="capture-review-empty-draft">
              No items in current review draft.
            </div>
          ) : (
            <div className="capture-review-items-list">
              {draftItems.map((item) => (
                <div key={item.id} className="capture-review-item-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleNameChange(item.id, e.target.value)}
                    disabled={isReadOnly}
                    aria-label="Item name"
                    className="capture-review-item-name-input"
                  />

                  <div className="capture-review-item-actions">
                    <div className="capture-review-qty-group">
                      <button
                        type="button"
                        className="btn-secondary capture-review-qty-btn"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={isReadOnly || item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="capture-review-qty-val">{item.quantity}</span>
                      <button
                        type="button"
                        className="btn-secondary capture-review-qty-btn"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        disabled={isReadOnly}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        className="btn-secondary capture-review-remove-btn"
                        onClick={() => handleRemove(item.id)}
                        aria-label="Remove item"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isReadOnly && (
            <form onSubmit={handleAddMissingItem} className="capture-review-add-form">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add missing item name..."
                aria-label="Missing item name"
                className="capture-review-add-name-input"
              />
              <div className="capture-review-add-controls">
                <input
                  type="number"
                  min={1}
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
                  className="capture-review-add-qty-input"
                  aria-label="Missing item quantity"
                />
                <button
                  type="submit"
                  className="btn-primary capture-review-add-btn"
                  disabled={!newItemName.trim()}
                >
                  + Add Item
                </button>
              </div>
            </form>
          )}

          {!isReadOnly && (
            <div className="capture-review-footer">
              <button
                type="button"
                className="btn-primary capture-review-confirm-btn"
                onClick={handleConfirmSubmission}
                disabled={draftItems.length === 0 || isSubmittingConfirm}
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
