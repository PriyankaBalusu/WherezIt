import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compressImage } from './compressImage';

describe('compressImage (IMG-003)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through small images (<= 4 MiB AND <= 2048 px long edge) unchanged', async () => {
    const smallFile = new File(['a'.repeat(1024 * 1024)], 'small.jpg', { type: 'image/jpeg' });
    
    // Mock createImageBitmap
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 800,
      close: vi.fn(),
    } as any);

    const result = await compressImage(smallFile);
    expect(result.compressed).toBe(false);
    expect(result.file).toBe(smallFile);
  });

  it('rejects unsupported image MIME types', async () => {
    const txtFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    await expect(compressImage(txtFile)).rejects.toThrow('Unsupported image format');
  });

  it('compresses oversized images to <= 4 MiB', async () => {
    const largeFile = new File(['a'.repeat(5 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 3000,
      height: 2000,
      close: vi.fn(),
    } as any);

    // Mock Canvas & toBlob
    const mockBlob = new Blob(['compressed-data'], { type: 'image/jpeg' });
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
        fillStyle: '',
        fillRect: vi.fn(),
      }),
      toBlob: vi.fn((callback) => callback(mockBlob)),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);

    const result = await compressImage(largeFile);
    expect(result.compressed).toBe(true);
    expect(result.file.size).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
});
