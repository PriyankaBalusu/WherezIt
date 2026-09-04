import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateContainer } from '../../containers/hooks/useContainers';
import { compressImage } from '../../images/utils/compressImage';
import { uploadPhysicalLabelImage, extractPhysicalLabelOcrText } from '../../containers/api/containerImageApi';
import { useAuth } from '../../auth/useAuth';

interface TakePhotoLabelModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
  onSwitchToManual: () => void;
}

export const TakePhotoLabelModal: React.FC<TakePhotoLabelModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  isOpen,
  onClose,
  onSwitchToManual,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { getIdToken } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedText, setDetectedText] = useState<string | null>(null);
  const [ocrFailed, setOcrFailed] = useState<boolean>(false);
  const [candidateText, setCandidateText] = useState<string>('');
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateContainer(workspaceId);

  if (!isOpen) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setErrorMessage(null);
    setOcrFailed(false);
    setIsProcessingOcr(true);

    try {
      const compressed = await compressImage(file);
      const token = await getIdToken();
      if (token) {
        // 1. Persist PHYSICAL_LABEL image first
        await uploadPhysicalLabelImage(workspaceId, containerId, compressed.file, token);
        await queryClient.invalidateQueries({ queryKey: ['physicalLabelImage', workspaceId, containerId] });
        await queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });

        // 2. Request server-side OCR via Vertex AI Gemini provider
        const ocrResult = await extractPhysicalLabelOcrText(workspaceId, containerId, token);
        setIsProcessingOcr(false);

        if (ocrResult && ocrResult.detectedText) {
          setDetectedText(ocrResult.detectedText);
          setCandidateText(ocrResult.detectedText);
          setOcrFailed(false);
        } else {
          setDetectedText(null);
          setCandidateText('');
          setOcrFailed(true);
        }
      } else {
        setIsProcessingOcr(false);
        setOcrFailed(true);
      }
    } catch (err: any) {
      setIsProcessingOcr(false);
      setOcrFailed(true);
    }
  };

  const handleResetPhoto = () => {
    setPreviewUrl(null);
    setDetectedText(null);
    setOcrFailed(false);
    setCandidateText('');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalLabel = candidateText.trim();

    try {
      setIsSaving(true);
      setErrorMessage(null);

      // 1. If text was confirmed or provided, persist physicalLabel on Container
      if (finalLabel) {
        await updateMutation.mutateAsync({
          containerId,
          data: { physicalLabel: finalLabel },
        });
      }

      // 2. Ensure physical label image & container queries are invalidated
      await queryClient.invalidateQueries({ queryKey: ['physicalLabelImage', workspaceId, containerId] });
      await queryClient.invalidateQueries({ queryKey: ['container', workspaceId, containerId] });

      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err.message || 'Failed to save physical label.');
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
      className="photo-label-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-label-modal-title"
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
          <h2 id="photo-label-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Take / Choose Label Photo
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
            aria-label="Close modal"
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

        {!previewUrl ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Take or upload a photo of a label or handwritten notes on <strong>{boxDisplayId}</strong>.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              capture="environment"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <button
                type="button"
                className="btn btn-primary btn--md"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%' }}
              >
                📷 Snap / Upload Photo
              </button>

              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={onSwitchToManual}
                style={{ width: '100%' }}
              >
                Enter Label Text Manually Instead
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center' }}>
              <img
                src={previewUrl}
                alt="Label preview"
                style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: '0.5rem', objectFit: 'contain', border: '1px solid #e2e8f0' }}
              />
            </div>

            {isProcessingOcr ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#0284c7', fontWeight: 600, fontSize: '0.9rem' }}>
                🔍 Reading visible text from label...
              </div>
            ) : ocrFailed ? (
              <div style={{ backgroundColor: '#fffbebfb', border: '1px solid #fde68a', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  We couldn't read the label automatically.
                </div>
                <div style={{ color: '#78350f', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  Your photo will still be saved as an Existing Label. You can also type text manually.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn--md"
                    onClick={onSwitchToManual}
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  >
                    Enter Label Text
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    Detected Text Suggestion
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0c4a6e', marginTop: '0.125rem' }}>
                    {detectedText}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="ocr-candidate-input" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                    Confirm or Edit Label Text
                  </label>
                  <input
                    id="ocr-candidate-input"
                    type="text"
                    value={candidateText}
                    onChange={(e) => setCandidateText(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem', fontSize: '0.95rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                    Verify or edit the label text before saving.
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={handleResetPhoto}
              >
                Retake Photo
              </button>
              <button
                type="submit"
                className="btn btn-primary btn--md"
                disabled={isSaving || isProcessingOcr}
              >
                {isSaving ? 'Saving...' : 'Save Label Photo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
