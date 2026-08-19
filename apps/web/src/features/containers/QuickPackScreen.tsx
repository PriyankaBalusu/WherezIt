import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useStorageLocations } from '../locations/hooks/useStorageLocations';
import { createContainer } from './api/containerApi';
import { compressImage } from '../images/utils/compressImage';

export const QuickPackScreen: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const { data: locations, isLoading: isLocationsLoading } = useStorageLocations(workspaceId || '');

  const [storageNodeId, setStorageNodeId] = useState<string>('');
  const [destinationStorageNodeId, setDestinationStorageNodeId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isPacked, setIsPacked] = useState<boolean>(false);
  const [movingPriority, setMovingPriority] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    if (!storageNodeId) {
      setError('Current storage location is required.');
      return;
    }

    if (!name.trim()) {
      setError('Container name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Create Container with moving metadata
      const container = await createContainer(
        workspaceId,
        {
          storageNodeId,
          name: name.trim(),
          description: description.trim() || undefined,
          destinationStorageNodeId: destinationStorageNodeId || undefined,
          isPacked,
          movingPriority: movingPriority || undefined,
        },
        getIdToken
      );

      // If photo provided, compress and upload
      if (selectedFile) {
        try {
          const compressed = await compressImage(selectedFile);
          const formData = new FormData();
          formData.append('file', compressed.file);

          const token = await getIdToken();
          const uploadRes = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(container.id)}/captures`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (uploadRes.ok) {
            const captureData = await uploadRes.json();
            if (captureData.captureId) {
              navigate(`/workspaces/${workspaceId}/captures/${captureData.captureId}/review`);
              return;
            }
          }
        } catch {
          // If upload fails, fallback gracefully to container detail
        }
      }

      // Navigate to container detail
      navigate(`/workspaces/${workspaceId}/containers/${container.id}`);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to complete quick pack.');
    }
  };

  if (isLocationsLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
        Loading storage locations...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1a202c' }}>
        Quick Pack Container
      </h2>

      {error && (
        <div role="alert" style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', border: '1px solid #feb2b2' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Current Location */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="quickpack-current-location" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Current Storage Location *
          </label>
          <select
            id="quickpack-current-location"
            value={storageNodeId}
            onChange={(e) => setStorageNodeId(e.target.value)}
            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e0' }}
            required
          >
            <option value="">-- Select Current Location --</option>
            {locations?.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Intended Destination Location */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="quickpack-destination-location" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Intended Destination Room / Location (Optional)
          </label>
          <select
            id="quickpack-destination-location"
            value={destinationStorageNodeId}
            onChange={(e) => setDestinationStorageNodeId(e.target.value)}
            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e0' }}
          >
            <option value="">-- None / Unknown --</option>
            {locations?.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Container Name */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="quickpack-container-name" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Container Name *
          </label>
          <input
            id="quickpack-container-name"
            type="text"
            placeholder="e.g. Kitchen Supplies Box A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e0' }}
            required
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="quickpack-container-desc" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Description (Optional)
          </label>
          <input
            id="quickpack-container-desc"
            type="text"
            placeholder="e.g. Fragile glassware and pots"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e0' }}
          />
        </div>

        {/* Packing Metadata */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={isPacked}
              onChange={(e) => setIsPacked(e.target.checked)}
              aria-label="Is Packed"
            />
            Mark as Packed
          </label>

          <div style={{ flex: 1 }}>
            <label htmlFor="quickpack-priority" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Moving Priority
            </label>
            <select
              id="quickpack-priority"
              value={movingPriority}
              onChange={(e) => setMovingPriority(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e0' }}
            >
              <option value="">Normal</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {/* Photo Upload Section */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f7fafc', borderRadius: '0.375rem', border: '1px dashed #cbd5e0' }}>
          <label htmlFor="quickpack-photo" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Container Photo for AI Inventory Recognition (Optional)
          </label>
          <input
            id="quickpack-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          {previewUrl && (
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: '180px', borderRadius: '0.25rem', objectFit: 'cover' }} />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ padding: '0.625rem 1.25rem', border: '1px solid #cbd5e0', borderRadius: '0.375rem', backgroundColor: '#fff', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ padding: '0.625rem 1.5rem', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Processing Quick Pack...' : selectedFile ? 'Upload & Analyze Photo' : 'Save Container'}
          </button>
        </div>
      </form>
    </div>
  );
};
