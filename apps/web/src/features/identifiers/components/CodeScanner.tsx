import React, { useState, useEffect, useRef } from 'react';
import { resolveContainerIdentifier, ResolvedContainerResponse } from '../api/identifierApi';

export interface CodeScannerProps {
  onResolve: (result: ResolvedContainerResponse) => void | Promise<void>;
  onError?: (message: string) => void;
  autoCloseOnResolve?: boolean;
  buttonText?: string;
}

export const CodeScanner: React.FC<CodeScannerProps> = ({
  onResolve,
  onError,
  autoCloseOnResolve = true,
  buttonText = '📷 Open Camera Scanner',
}) => {

  const [codeValue, setCodeValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unassignedCode, setUnassignedCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleStartCamera = async () => {
    setError(null);
    setCameraError(null);
    setUnassignedCode(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // If native BarcodeDetector is supported by browser, run detection loop
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'],
          });

          const detectLoop = async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const detectedValue = barcodes[0].rawValue;
                  if (detectedValue) {
                    stopCamera();
                    handleResolveCode(detectedValue);
                    return;
                  }
                }
              } catch {
                // Ignore frame detection errors
              }
            }
            animFrameRef.current = requestAnimationFrame(detectLoop);
          };

          animFrameRef.current = requestAnimationFrame(detectLoop);
        } catch {
          // BarcodeDetector instantiation failed
        }
      }
    } catch (err: any) {
      stopCamera();
      setCameraError(err.message || 'Unable to access camera. Please check permissions.');
    }
  };

  const handleResolveCode = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Please enter or scan a valid code.');
      if (onError) onError('Please enter or scan a valid code.');
      return;
    }

    setError(null);
    setUnassignedCode(null);
    setIsResolving(true);

    try {
      const result = await resolveContainerIdentifier(trimmed);
      setIsResolving(false);
      setCodeValue('');
      if (autoCloseOnResolve) {
        stopCamera();
      }
      await onResolve(result);
    } catch (err: any) {
      setIsResolving(false);
      setUnassignedCode(trimmed);
      const errMsg = err.message || 'Container not found or unavailable.';
      setError(errMsg);
      if (onError) onError(errMsg);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleResolveCode(codeValue);
  };

  return (
    <div>
      {error && (
        <div role="alert" className="quickpack-error-banner" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {cameraError && (
        <div role="alert" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          {cameraError}
        </div>
      )}

      {unassignedCode && (
        <div style={{ backgroundColor: '#fffbebfb', border: '1px solid #fde68a', padding: '1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, color: '#b45309', fontSize: '1rem', marginBottom: '0.25rem' }}>
            Code Not Linked to an Active Box
          </div>
          <p style={{ fontSize: '0.875rem', color: '#78350f', margin: '0 0 1rem 0' }}>
            The code <code>{unassignedCode}</code> is not linked to a container in this storage space, or is unassigned.
          </p>
        </div>
      )}

      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        {isScanning ? (
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxHeight: '320px', overflow: 'hidden', borderRadius: '0.5rem', marginBottom: '1rem', backgroundColor: '#000' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Position QR code or barcode within camera frame
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={stopCamera}
              >
                Close Camera
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn--md"
            onClick={handleStartCamera}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}
          >
            {buttonText}
          </button>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="global-scan-input" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Enter Code Manually
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
              <input
                id="global-scan-input"
                type="text"
                placeholder="Enter QR or barcode value"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                style={{ flex: 1, padding: '0.625rem', fontSize: '0.95rem' }}
              />
              <button
                type="submit"
                className="btn btn-secondary btn--md"
                disabled={isResolving || !codeValue.trim()}
              >
                {isResolving ? 'Searching...' : 'Find Box'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
