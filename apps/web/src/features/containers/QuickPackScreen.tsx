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
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        Loading storage locations...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '680px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          GUIDED WORKFLOW
        </span>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 800, margin: '0.25rem 0', color: '#0f172a' }}>
          Quick Pack Container
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Pack a box, assign location metadata, and scan/photo contents for AI recognition.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #fca5a5' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Step 1: Location & Destination */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <span style={{ backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 800, width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Storage & Destination Locations</h3>
          </div>

          <div className="form-group">
            <label htmlFor="quickpack-current-location">Current Storage Location *</label>
            <select
              id="quickpack-current-location"
              value={storageNodeId}
              onChange={(e) => setStorageNodeId(e.target.value)}
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quickpack-destination-location">Intended Destination Room / Location (Optional)</label>
            <select
              id="quickpack-destination-location"
              value={destinationStorageNodeId}
              onChange={(e) => setDestinationStorageNodeId(e.target.value)}
            >
              <option value="">-- None / Unknown --</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Container Details */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <span style={{ backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 800, width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Container Information & Status</h3>
          </div>

          <div className="form-group">
            <label htmlFor="quickpack-container-name">Container Name *</label>
            <input
              id="quickpack-container-name"
              type="text"
              placeholder="e.g. Kitchen Supplies Box A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quickpack-container-desc">Description (Optional)</label>
            <input
              id="quickpack-container-desc"
              type="text"
              placeholder="e.g. Fragile glassware and pots"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isPacked}
                onChange={(e) => setIsPacked(e.target.checked)}
                aria-label="Is Packed"
              />
              Mark as Packed
            </label>

            <div>
              <label htmlFor="quickpack-priority" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Moving Priority
              </label>
              <select
                id="quickpack-priority"
                value={movingPriority}
                onChange={(e) => setMovingPriority(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
              >
                <option value="">Normal</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Photo Capture / AI Recognition */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
            <span style={{ backgroundColor: '#f59e0b', color: '#ffffff', fontWeight: 800, width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>3</span>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Contents Photo & AI Recognition (Optional)</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Take or upload a photo of the box contents. AI will detect items for explicit human review.
          </p>

          <input
            id="quickpack-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />

          {previewUrl && (
            <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: '200px', borderRadius: '0.5rem', objectFit: 'cover' }} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{ padding: '0.75rem 1.75rem' }}
          >
            {isSubmitting ? 'Processing Quick Pack...' : selectedFile ? 'Upload & Analyze Photo' : 'Save Container'}
          </button>
        </div>
      </form>
    </div>
  );
};
