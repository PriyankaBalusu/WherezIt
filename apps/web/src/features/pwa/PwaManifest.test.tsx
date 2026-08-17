import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Installability Foundation (PWA-001)', () => {
  const publicDir = path.resolve(__dirname, '../../../public');
  const indexHtmlPath = path.resolve(__dirname, '../../../index.html');
  const manifestPath = path.resolve(publicDir, 'manifest.webmanifest');

  it('manifest.webmanifest exists and contains required installability fields', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);

    const rawContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(rawContent);

    expect(manifest.short_name).toBe('WherezIt');
    expect(manifest.name).toBe('WherezIt Storage Memory');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('index.html contains link to manifest.webmanifest and theme-color meta tag', () => {
    expect(fs.existsSync(indexHtmlPath)).toBe(true);

    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(htmlContent).toContain('rel="manifest"');
    expect(htmlContent).toContain('href="/manifest.webmanifest"');
    expect(htmlContent).toContain('name="theme-color"');
  });

  it('manifest does not store tokens or sensitive API information', () => {
    const rawContent = fs.readFileSync(manifestPath, 'utf-8');
    expect(rawContent).not.toContain('Bearer');
    expect(rawContent).not.toContain('firebase_uid');
    expect(rawContent).not.toContain('apiKey');
  });
});
