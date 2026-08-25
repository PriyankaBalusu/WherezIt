import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compressImage } from './compressImage';
import heic2any from 'heic2any';

vi.mock('heic2any', () => ({
  default: vi.fn(),
}));

describe('compressImage (IMG-003 & HEIC Support)', () => {
  const setupMockCanvas = () => {
    const mockBlob = new Blob(['fake-compressed-bytes'], { type: 'image/jpeg' });
    const mockCanvas = {
      width: 1000,
      height: 800,
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
        fillStyle: '',
        fillRect: vi.fn(),
      }),
      toBlob: vi.fn((callback) => callback(mockBlob)),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as any;
      }
      return originalCreateElement(tagName);
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through small JPEG images (<= 4 MiB AND <= 2048 px long edge) unchanged', async () => {
    const smallFile = new File(['a'.repeat(1024 * 1024)], 'small.jpg', { type: 'image/jpeg' });
    
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 800,
      close: vi.fn(),
    } as any);

    const result = await compressImage(smallFile);
    expect(result.compressed).toBe(false);
    expect(result.file).toBe(smallFile);
  });

  it('converts .heic file client-side to image/jpeg (.jpg)', async () => {
    setupMockCanvas();
    const mockJpgBlob = new Blob(['fake-jpg-bytes'], { type: 'image/jpeg' });
    vi.mocked(heic2any).mockResolvedValueOnce(mockJpgBlob);

    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1200,
      height: 900,
      close: vi.fn(),
    } as any);

    const heicFile = new File(['fake-heic-bytes'], 'photo.heic', { type: 'image/heic' });
    const result = await compressImage(heicFile);

    expect(heic2any).toHaveBeenCalledWith(expect.objectContaining({
      toType: 'image/jpeg',
      quality: 0.85,
    }));
    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.name).toBe('photo.jpg');
  });

  it('converts uppercase extension .HEIC and image/heif to image/jpeg', async () => {
    setupMockCanvas();
    const mockJpgBlob = new Blob(['fake-jpg-bytes'], { type: 'image/jpeg' });
    vi.mocked(heic2any).mockResolvedValueOnce(mockJpgBlob);

    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    } as any);

    const heicFile = new File(['fake-heic-bytes'], 'IMG_999.HEIC', { type: '' });
    const result = await compressImage(heicFile);

    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.name).toBe('IMG_999.jpg');
  });

  it('handles image/jpg and image/pjpeg aliases by normalizing to image/jpeg', async () => {
    setupMockCanvas();
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 800,
      close: vi.fn(),
    } as any);

    const jpgAliasFile = new File(['jpg-alias-data'], 'test.jpg', { type: 'image/jpg' });
    const result = await compressImage(jpgAliasFile);

    expect(result.file.type).toBe('image/jpeg');
  });

  it('handles PNG and WebP formats without converting if within bounds', async () => {
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 800,
      close: vi.fn(),
    } as any);

    const pngFile = new File(['png-data'], 'test.png', { type: 'image/png' });
    const resultPng = await compressImage(pngFile);
    expect(resultPng.file.type).toBe('image/png');

    const webpFile = new File(['webp-data'], 'test.webp', { type: 'image/webp' });
    const resultWebp = await compressImage(webpFile);
    expect(resultWebp.file.type).toBe('image/webp');
  });

  it('provides friendly error message when HEIC conversion fails', async () => {
    vi.mocked(heic2any).mockRejectedValueOnce(new Error('Decoder error'));

    const corruptedHeic = new File(['invalid-bytes'], 'bad.heic', { type: 'image/heic' });
    await expect(compressImage(corruptedHeic)).rejects.toThrow(
      "We couldn't prepare this HEIC photo. Try another photo or choose a JPG, PNG, or WebP image."
    );
  });

  it('rejects unsupported image MIME types like text/plain', async () => {
    const txtFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    await expect(compressImage(txtFile)).rejects.toThrow('Unsupported image format');
  });
});
