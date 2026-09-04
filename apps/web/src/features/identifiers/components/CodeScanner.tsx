import React, { useState, useEffect, useRef } from 'react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  BinaryBitmap,
  NotFoundException,
} from '@zxing/library';
import { resolveContainerIdentifier, ResolvedContainerResponse } from '../api/identifierApi';

const zxingHints = new Map();
zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
]);
zxingHints.set(DecodeHintType.TRY_HARDER, true);

const zxingReader = new MultiFormatReader();
zxingReader.setHints(zxingHints);

export interface CodeScannerProps {
  onResolve?: (result: ResolvedContainerResponse) => void | Promise<void>;
  onScanRaw?: (rawCode: string, format?: string) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
  autoCloseOnResolve?: boolean;
  buttonText?: string;
  expectedFormats?: string[];
  scanMode?: 'WHEREZIT_PREFER' | 'WHEREZIT_ONLY' | 'ALL';
  autoStart?: boolean;
  hideManualInput?: boolean;
}

export const CodeScanner: React.FC<CodeScannerProps> = ({
  onResolve,
  onScanRaw,
  onCancel,
  onError,
  autoCloseOnResolve = true,
  buttonText = '📷 Open Camera Scanner',
  expectedFormats,
  scanMode = 'WHEREZIT_PREFER',
  autoStart = false,
  hideManualInput = false,
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
  const detectionHistoryRef = useRef<Map<string, { count: number; firstSeen: number; lastSeen: number }>>(new Map());
  const lastZxingRunRef = useRef<number>(0);
  const lastZxingNotFoundLogRef = useRef<number>(0);
  const isResolvingAsyncRef = useRef<boolean>(false);
  const failedLookupCooldownRef = useRef<Map<string, number>>(new Map());

  const stopCamera = () => {
    detectionHistoryRef.current.clear();
    failedLookupCooldownRef.current.clear();
    isResolvingAsyncRef.current = false;
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
    if (autoStart) {
      handleStartCamera();
    }
    return () => {
      stopCamera();
    };
  }, []);

  const handleCloseCameraClick = () => {
    stopCamera();
    if (onCancel) {
      onCancel();
    }
  };

  const triggerGenericLookup = async (rawValue: string, format: string, key: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    isResolvingAsyncRef.current = true;
    setIsResolving(true);

    try {
      console.debug('[CodeScanner] Attempting resolution for generic barcode:', trimmed);
      const result = await resolveContainerIdentifier(trimmed);
      setIsResolving(false);
      isResolvingAsyncRef.current = false;
      setCodeValue('');
      if (autoCloseOnResolve) {
        stopCamera();
      }
      if (onResolve) {
        await onResolve(result);
      }
    } catch (err: any) {
      setIsResolving(false);
      isResolvingAsyncRef.current = false;

      const isNotFound =
        err.status === 404 ||
        (err.message && (err.message.toLowerCase().includes('not found') || err.message.toLowerCase().includes('unavailable')));

      if (isNotFound) {
        console.debug('[CodeScanner] Generic barcode not found in database, continuing scan:', trimmed);
        failedLookupCooldownRef.current.set(key, Date.now() + 3000);
        setUnassignedCode(trimmed);
        setTimeout(() => setUnassignedCode((prev) => (prev === trimmed ? null : prev)), 4000);
      } else {
        stopCamera();
        const errMsg = err.message || 'Error communicating with server.';
        setError(errMsg);
        if (onError) onError(errMsg);
      }
    }
  };

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

      const isRestrictedMode =
        scanMode === 'WHEREZIT_ONLY' ||
        (expectedFormats &&
          expectedFormats.length > 0 &&
          !expectedFormats.some((f) => ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'all'].includes(f.toLowerCase())));

      const requestedFormats =
        expectedFormats && expectedFormats.length > 0
          ? expectedFormats.map((f) => f.toLowerCase())
          : isRestrictedMode
          ? ['qr_code', 'code_128']
          : ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'];

      const zxingFormats: BarcodeFormat[] = [];
      if (requestedFormats.includes('code_128')) zxingFormats.push(BarcodeFormat.CODE_128);
      if (requestedFormats.includes('qr_code')) zxingFormats.push(BarcodeFormat.QR_CODE);

      if (!isRestrictedMode) {
        if (requestedFormats.includes('ean_13')) zxingFormats.push(BarcodeFormat.EAN_13);
        if (requestedFormats.includes('ean_8')) zxingFormats.push(BarcodeFormat.EAN_8);
        if (requestedFormats.includes('upc_a')) zxingFormats.push(BarcodeFormat.UPC_A);
        if (requestedFormats.includes('upc_e')) zxingFormats.push(BarcodeFormat.UPC_E);
        if (requestedFormats.includes('code_39')) zxingFormats.push(BarcodeFormat.CODE_39);
      }

      const dynamicZxingHints = new Map();
      dynamicZxingHints.set(DecodeHintType.POSSIBLE_FORMATS, zxingFormats);
      dynamicZxingHints.set(DecodeHintType.TRY_HARDER, true);
      zxingReader.setHints(dynamicZxingHints);

      // If native BarcodeDetector is supported by browser, run detection loop
      if ('BarcodeDetector' in window) {
        try {
          let supportedFormats: string[] = [];

          if (typeof (window as any).BarcodeDetector.getSupportedFormats === 'function') {
            try {
              supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
            } catch (e) {
              console.error('[CodeScanner] error getting supported formats', e);
            }
          }

          console.debug('[CodeScanner] supported barcode formats', supportedFormats);
          console.debug('[CodeScanner] requested barcode formats', requestedFormats);

          let activeFormats: string[] = [...requestedFormats];
          if (Array.isArray(supportedFormats) && supportedFormats.length > 0) {
            const filtered = requestedFormats.filter((f) => supportedFormats.includes(f));
            if (filtered.length > 0) {
              activeFormats = filtered;
            }
          }

          console.debug('[CodeScanner] active barcode formats', activeFormats);

          let barcodeDetector: any;
          try {
            barcodeDetector = new (window as any).BarcodeDetector({ formats: activeFormats });
          } catch (initErr) {
            console.warn('[CodeScanner] Instantiating with activeFormats failed, falling back to default formats', initErr);
            barcodeDetector = new (window as any).BarcodeDetector();
          }

          const isCorruptCode128 = (format: string, value: string): boolean => {
            if (format === 'code_128') {
              return /[\x00-\x1F\x7F]/.test(value);
            }
            return false;
          };

          const isWziPattern = (val: string) =>
            val.includes('wzi_qr_') ||
            val.includes('wzi_bar_') ||
            val.startsWith('WZB_') ||
            val.includes('/scan/');

          const isPriorityA = (fmt: string, val: string) =>
            isWziPattern(val) || fmt === 'qr_code' || (fmt === 'code_128' && isWziPattern(val));

          const prioritizeCandidates = (items: any[]) => {
            return [...items].sort((a, b) => {
              const valA = a.rawValue || '';
              const valB = b.rawValue || '';
              const prioA = isPriorityA(a.format, valA);
              const prioB = isPriorityA(b.format, valB);

              if (prioA && !prioB) return -1;
              if (!prioA && prioB) return 1;

              return 0;
            });
          };

          const isEanOrUpcOrGeneric = (fmt: string, val: string) => !isPriorityA(fmt, val);

          const hasRecentHighPriority = () => {
            const now = Date.now();
            for (const [k, v] of detectionHistoryRef.current.entries()) {
              if (now - v.lastSeen <= 2000) {
                const colonIdx = k.indexOf(':');
                const fmt = colonIdx >= 0 ? k.substring(0, colonIdx) : '';
                const val = colonIdx >= 0 ? k.substring(colonIdx + 1) : k;
                if (isPriorityA(fmt, val)) {
                  return true;
                }
              }
            }
            return false;
          };

          const detectLoop = async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const now = Date.now();
              let nativeBarcodes: any[] = [];
              try {
                nativeBarcodes = await barcodeDetector.detect(videoRef.current);
              } catch (error) {
                console.error('[CodeScanner] BarcodeDetector detect error', error);
              }

              const rawCandidates = [...(nativeBarcodes || [])];

              const foundNativeHighPriority = rawCandidates.some(
                (r: any) =>
                  r.format === 'code_128' ||
                  r.format === 'qr_code' ||
                  (r.rawValue && (r.rawValue.includes('wzi_') || r.rawValue.startsWith('WZB_') || r.rawValue.includes('/scan/')))
              );

              if (!foundNativeHighPriority && now - lastZxingRunRef.current >= 200) {
                const video = videoRef.current;
                if (video && video instanceof HTMLVideoElement && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                  lastZxingRunRef.current = now;
                  const width = video.videoWidth;
                  const height = video.videoHeight;
                  if (width > 0 && height > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                      ctx.drawImage(video, 0, 0, width, height);
                      const imageData = ctx.getImageData(0, 0, width, height);
                      const data = imageData.data;
                      const luminances = new Uint8ClampedArray(width * height);
                      for (let i = 0; i < luminances.length; i++) {
                        const offset = i * 4;
                        const r = data[offset];
                        const g = data[offset + 1];
                        const b = data[offset + 2];
                        luminances[i] = (r * 306 + g * 601 + b * 117) >> 10;
                      }

                      const fullSource = new RGBLuminanceSource(luminances, width, height);

                      const tryDecodeBitmap = (bitmap: BinaryBitmap) => {
                        try {
                          return zxingReader.decodeWithState(bitmap);
                        } finally {
                          zxingReader.reset();
                        }
                      };

                      const tryDecodeSource = (source: RGBLuminanceSource) => {
                        try {
                          return tryDecodeBitmap(new BinaryBitmap(new HybridBinarizer(source)));
                        } catch (err) {
                          if (err instanceof NotFoundException) {
                            return tryDecodeBitmap(new BinaryBitmap(new GlobalHistogramBinarizer(source)));
                          }
                          throw err;
                        }
                      };

                      let zxingResult = null;
                      try {
                        zxingResult = tryDecodeSource(fullSource);
                      } catch (err) {
                        if (err instanceof NotFoundException) {
                          const cropW = Math.floor(width * 0.75);
                          const cropH = Math.floor(height * 0.75);
                          const cropLeft = Math.floor((width - cropW) / 2);
                          const cropTop = Math.floor((height - cropH) / 2);
                          const centerSource = fullSource.crop(cropLeft, cropTop, cropW, cropH);
                          try {
                            zxingResult = tryDecodeSource(centerSource);
                          } catch (centerErr) {
                            if (centerErr instanceof NotFoundException) {
                              if (now - lastZxingNotFoundLogRef.current >= 2000) {
                                lastZxingNotFoundLogRef.current = now;
                                console.debug('[CodeScanner][ZXing] no barcode found (full & center crop)');
                              }
                            } else {
                              console.error('[CodeScanner][ZXing] decode error (center crop)', centerErr);
                            }
                          }
                        } else {
                          console.error('[CodeScanner][ZXing] decode error (full frame)', err);
                        }
                      }

                      if (zxingResult && zxingResult.getText()) {
                        console.debug('[CodeScanner][ZXing] decoded', {
                          format: zxingResult.getBarcodeFormat(),
                          text: zxingResult.getText(),
                        });
                        const text = zxingResult.getText();
                        const formatEnum = zxingResult.getBarcodeFormat();
                        const formatStr =
                          formatEnum === BarcodeFormat.CODE_128
                            ? 'code_128'
                            : formatEnum === BarcodeFormat.QR_CODE
                            ? 'qr_code'
                            : formatEnum === BarcodeFormat.EAN_13
                            ? 'ean_13'
                            : formatEnum === BarcodeFormat.EAN_8
                            ? 'ean_8'
                            : formatEnum === BarcodeFormat.UPC_A
                            ? 'upc_a'
                            : formatEnum === BarcodeFormat.UPC_E
                            ? 'upc_e'
                            : formatEnum === BarcodeFormat.CODE_39
                            ? 'code_39'
                            : 'zxing_barcode';
                        rawCandidates.push({ format: formatStr, rawValue: text });
                      }
                    }
                  }
                }
              }

              if (rawCandidates.length > 0) {
                console.debug(
                  '[CodeScanner] detections',
                  rawCandidates.map((r: any) => ({
                    format: r.format,
                    rawValue: r.rawValue,
                  }))
                );

                let validBarcodes = rawCandidates.filter(
                  (r: any) => r.rawValue && !isCorruptCode128(r.format, r.rawValue)
                );

                if (scanMode === 'WHEREZIT_ONLY' || (expectedFormats && !expectedFormats.some(f => ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'all'].includes(f)))) {
                  validBarcodes = validBarcodes.filter((r: any) => !isEanOrUpcOrGeneric(r.format, r.rawValue));
                }

                if (validBarcodes.length > 0) {
                  const sorted = prioritizeCandidates(validBarcodes);
                  const history = detectionHistoryRef.current;

                  for (const [k, v] of history.entries()) {
                    if (now - v.lastSeen > 2000) {
                      history.delete(k);
                    }
                  }

                  for (const candidate of sorted) {
                    const isHighPriority = isPriorityA(candidate.format, candidate.rawValue);

                    const key = `${candidate.format}:${candidate.rawValue}`;

                    // Skip candidates currently in 404 lookup cooldown
                    const cooldownUntil = failedLookupCooldownRef.current.get(key) || 0;
                    if (now < cooldownUntil) {
                      continue;
                    }

                    const existing = history.get(key);
                    const newCount = existing ? existing.count + 1 : 1;
                    const firstSeen = existing ? existing.firstSeen : now;
                    history.set(key, { count: newCount, firstSeen, lastSeen: now });

                    if (isHighPriority) {
                      const requiredHits = isWziPattern(candidate.rawValue) ? 1 : 2;
                      if (newCount >= requiredHits) {
                        history.clear();
                        stopCamera();
                        handleResolveCode(candidate.rawValue, candidate.format);
                        return;
                      }
                    } else if (isEanOrUpcOrGeneric(candidate.format, candidate.rawValue)) {
                      if (hasRecentHighPriority()) {
                        console.debug('[CodeScanner] Suppressing generic candidate because recent high priority code exists in history:', candidate.rawValue);
                        continue;
                      }

                      if (newCount >= 3) {
                        if (onScanRaw) {
                          history.clear();
                          stopCamera();
                          handleResolveCode(candidate.rawValue, candidate.format);
                          return;
                        }

                        if (!isResolvingAsyncRef.current) {
                          history.delete(key);
                          triggerGenericLookup(candidate.rawValue, candidate.format, key);
                        }
                      }
                    }
                  }
                }
              }
            }
            animFrameRef.current = requestAnimationFrame(detectLoop);
          };

          animFrameRef.current = requestAnimationFrame(detectLoop);
        } catch (err) {
          console.error('[CodeScanner] BarcodeDetector setup error', err);
        }
      }
    } catch (err: any) {
      stopCamera();
      setCameraError(err.message || 'Unable to access camera. Please check permissions.');
    }
  };

  const handleResolveCode = async (value: string, format?: string) => {
    console.debug('[CodeScanner] handleResolveCode', {
      raw: value,
      trimmed: value.trim(),
      length: value.trim().length,
      format,
    });
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Please enter or scan a valid code.');
      if (onError) onError('Please enter or scan a valid code.');
      return;
    }

    setError(null);
    setUnassignedCode(null);

    if (onScanRaw) {
      stopCamera();
      onScanRaw(trimmed, format);
      return;
    }

    if (!onResolve) return;

    setIsResolving(true);

    try {
      console.debug('[CodeScanner] calling resolver', trimmed);
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
    console.debug('[CodeScanner] handleSubmit', {
      codeValue,
      length: codeValue.length,
    });
    handleResolveCode(codeValue);
  };

  return (
    <div>
      {error && (
        <div role="alert" className="quickpack-error-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {cameraError && (
        <div role="alert" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          {cameraError}
        </div>
      )}

      {unassignedCode && (
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-warning, #d97706)', fontSize: '1rem', marginBottom: '0.25rem' }}>
            Code Not Linked to an Active Box
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #78350f)', margin: '0 0 1rem 0' }}>
            The code <code style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', userSelect: 'all' }}>{unassignedCode}</code> is not linked to a container in this storage space, or is unassigned.
          </p>
        </div>
      )}

      <div className={hideManualInput ? '' : 'card'} style={hideManualInput ? { marginBottom: 0 } : { padding: '1.75rem', marginBottom: '1.5rem' }}>
        {isScanning ? (
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center',
              marginBottom: hideManualInput ? 0 : '1.5rem',
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
                onClick={handleCloseCameraClick}
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
            style={{ width: '100%', justifyContent: 'center', marginBottom: hideManualInput ? 0 : '1.5rem' }}
          >
            {buttonText}
          </button>
        )}

        {!hideManualInput && (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="global-scan-input" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                Enter Code Manually
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                <input
                  id="global-scan-input"
                  type="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Enter QR or barcode value"
                  value={codeValue}
                  onChange={(e) => {
                    console.debug('[CodeScanner] onChange', {
                      raw: e.target.value,
                      length: e.target.value.length,
                    });
                    setCodeValue(e.target.value);
                  }}
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
        )}
      </div>
    </div>
  );
};
