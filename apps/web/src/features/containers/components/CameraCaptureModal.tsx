import React, { useState, useEffect, useRef } from 'react';
import { useImageUpload } from '../../images/hooks/useImageUpload';
import { compressImage } from '../../images/utils/compressImage';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB (IMG-002 limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CameraCaptureModalProps {
  workspaceId: string;
  containerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  workspaceId,
  containerId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useImageUpload(workspaceId, containerId);

  // Clean up object URL when file changes or component unmounts
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  // Clean up on modal close
  const handleClose = () => {
    setSelectedFile(null);
    setValidationError(null);
    setIsProcessing(false);
    uploadMutation.reset();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Please select a JPG, PNG, or WebP image.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      setValidationError(null);

      // Preprocess / Compress image (IMG-003)
      const compressionResult = await compressImage(selectedFile);
      const fileToUpload = compressionResult.file;

      if (fileToUpload.size > MAX_FILE_SIZE_BYTES) {
        setValidationError('Compressed image size exceeds maximum 10 MB backend upload limit.');
        setIsProcessing(false);
        return;
      }

      await uploadMutation.mutateAsync(fileToUpload);
      setIsProcessing(false);
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setIsProcessing(false);
      setValidationError(err.message || 'Image upload failed. Please try again.');
    }
  };

  if (!isOpen) return null;

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
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        <h2 id="camera-modal-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Capture Container Photo
        </h2>

        {validationError && (
          <div role="alert" style={{ color: '#e53e3e', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {validationError}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}
            aria-label="Select or capture image"
            disabled={isProcessing || uploadMutation.isPending}
          />
          <span style={{ fontSize: '0.75rem', color: '#718096' }}>
            Supports camera capture on mobile devices or file selection (auto-compressed to &lt;= 4MB).
          </span>
        </div>

        {previewUrl && (
          <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <img
              src={previewUrl}
              alt="Captured preview"
              style={{
                maxWidth: '100%',
                maxHeight: '250px',
                borderRadius: '0.375rem',
                objectFit: 'cover',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e2e8f0',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
            disabled={isProcessing || uploadMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isProcessing || uploadMutation.isPending}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: !selectedFile || isProcessing || uploadMutation.isPending ? '#cbd5e0' : '#3182ce',
              color: '#fff',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: !selectedFile || isProcessing || uploadMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isProcessing ? 'Preparing photo...' : uploadMutation.isPending ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      </div>
    </div>
  );
};

