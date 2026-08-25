/**
 * IMG-003 & HEIC: Client-side image compression, HEIC conversion, and resizing utility.
 * Contract:
 * - Target: <= 4 MiB (4,194,304 bytes)
 * - Max long edge: 2048 px
 * - Pass-through allowed ONLY when BOTH size <= 4 MiB AND long edge <= 2048 px
 * - Initial quality: 0.85, min quality: 0.50, step: 0.05 (max 7 attempts)
 * - Dimension reduction factor: 0.8 (max 2 iterations if quality reduction is insufficient)
 * - HEIC/HEIF photos: converted client-side to JPEG via dynamic import of heic2any
 * - Normalized MIME: image/jpeg for converted HEIC/HEIF and JPG aliases
 */

const MAX_TARGET_BYTES = 4 * 1024 * 1024; // 4 MiB
const MAX_LONG_EDGE = 2048;
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.50;
const QUALITY_DECREMENT = 0.05;
const MAX_QUALITY_ATTEMPTS = 7;
const DIMENSION_REDUCTION_FACTOR = 0.8;
const MAX_DIMENSION_ITERATIONS = 2;

export interface CompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/**
 * Gets image dimensions using createImageBitmap or HTMLImageElement decoding.
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number; imageSource: CanvasImageSource }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, imageSource: bitmap };
    } catch {
      // Fallback to Image element if createImageBitmap fails
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, imageSource: img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression.'));
    };
    img.src = url;
  });
}

/**
 * Draws image source onto canvas with specified target dimensions.
 * For PNG conversion to JPEG, flattens background to solid white.
 */
function drawToCanvas(
  imageSource: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  flattenToWhite: boolean = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  if (flattenToWhite) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);
  return canvas;
}

/**
 * Converts canvas to Blob with given MIME type and quality.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export canvas to Blob.'));
        }
      },
      mimeType,
      quality
    );
  });
}

export async function compressImage(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  // Validate and normalize format
  let rawType = (file.type || '').toLowerCase();
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';

  if (rawType === 'image/jpg' || rawType === 'image/pjpeg') {
    rawType = 'image/jpeg';
  }

  let fileToProcess = file;

  // HEIC/HEIF Client-Side Conversion Seam (Dynamic import to avoid blocking test runtime)
  if (rawType === 'image/heic' || rawType === 'image/heif' || ext === 'heic' || ext === 'heif') {
    try {
      const heicModule = await import('heic2any');
      const heic2any = heicModule.default || heicModule;

      const convertedResult = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      });

      const convertedBlob = Array.isArray(convertedResult) ? convertedResult[0] : convertedResult;
      const baseName = file.name.replace(/\.(heic|heif)$/i, '');
      const newJpgName = `${baseName || 'photo'}.jpg`;

      fileToProcess = new File([convertedBlob], newJpgName, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      rawType = 'image/jpeg';
    } catch (err: any) {
      console.error('[HEIC Conversion Failed]', err);
      throw new Error("We couldn't prepare this HEIC photo. Try another photo or choose a JPG, PNG, or WebP image.");
    }
  }

  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(rawType)) {
    throw new Error('Unsupported image format. Only JPG, PNG, and WebP are allowed.');
  }

  // Create file with normalized type if needed
  const normalizedFile = rawType === fileToProcess.type ? fileToProcess : new File([fileToProcess], fileToProcess.name, { type: rawType, lastModified: fileToProcess.lastModified });

  // Check dimensions
  const { width, height, imageSource } = await getImageDimensions(normalizedFile);
  const longEdge = Math.max(width, height);

  // Pass-through check: size <= 4 MiB AND long edge <= 2048 px AND type untouched
  if (originalSize <= MAX_TARGET_BYTES && longEdge <= MAX_LONG_EDGE && rawType === file.type) {
    return {
      file: normalizedFile,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  // Preprocessing required
  let currentWidth = width;
  let currentHeight = height;

  // Scale down long edge to 2048 px initial max if needed
  if (longEdge > MAX_LONG_EDGE) {
    const scale = MAX_LONG_EDGE / longEdge;
    currentWidth = Math.round(width * scale);
    currentHeight = Math.round(height * scale);
  }

  let dimensionIteration = 0;

  while (dimensionIteration <= MAX_DIMENSION_ITERATIONS) {
    if (dimensionIteration > 0) {
      currentWidth = Math.round(currentWidth * DIMENSION_REDUCTION_FACTOR);
      currentHeight = Math.round(currentHeight * DIMENSION_REDUCTION_FACTOR);
    }

    // Determine encoding strategy
    let mimeType = normalizedFile.type;
    let flattenWhite = false;

    // For PNG: attempt PNG export first; if PNG resize is still > 4 MiB, convert to JPEG with white background
    const canvas = drawToCanvas(imageSource, currentWidth, currentHeight, false);

    if (normalizedFile.type === 'image/png') {
      const pngBlob = await canvasToBlob(canvas, 'image/png');
      if (pngBlob.size <= MAX_TARGET_BYTES) {
        const compressedFile = new File([pngBlob], normalizedFile.name, { type: 'image/png', lastModified: Date.now() });
        return {
          file: compressedFile,
          compressed: true,
          originalSize,
          compressedSize: compressedFile.size,
        };
      }

      // Resized PNG remains > 4 MiB; switch to JPEG conversion (flattened white background)
      mimeType = 'image/jpeg';
      flattenWhite = true;
    } else if (normalizedFile.type === 'image/webp') {
      mimeType = 'image/webp';
    } else {
      mimeType = 'image/jpeg';
    }

    const exportCanvas = flattenWhite ? drawToCanvas(imageSource, currentWidth, currentHeight, true) : canvas;

    // Quality reduction loop
    let currentQuality = INITIAL_QUALITY;
    let qualityAttempt = 1;

    while (qualityAttempt <= MAX_QUALITY_ATTEMPTS && currentQuality >= MIN_QUALITY - 0.001) {
      const blob = await canvasToBlob(exportCanvas, mimeType, currentQuality);
      if (blob.size <= MAX_TARGET_BYTES) {
        const outputExt = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
        let outputName = normalizedFile.name;
        if (flattenWhite && !outputName.toLowerCase().endsWith('.jpg') && !outputName.toLowerCase().endsWith('.jpeg')) {
          outputName = outputName.replace(/\.[^/.]+$/, '') + outputExt;
        }

        const compressedFile = new File([blob], outputName, { type: mimeType, lastModified: Date.now() });
        return {
          file: compressedFile,
          compressed: true,
          originalSize,
          compressedSize: compressedFile.size,
        };
      }

      currentQuality -= QUALITY_DECREMENT;
      qualityAttempt++;
    }

    dimensionIteration++;
  }

  // Failed to satisfy <= 4 MiB within bounds
  throw new Error(`Unable to compress image below 4 MiB threshold. Please select a smaller photo.`);
}
