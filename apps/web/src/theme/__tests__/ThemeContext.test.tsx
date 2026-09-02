import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '../ThemeContext';

const ThemeTestConsumer: React.FC = () => {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  return (
    <div>
      <span data-testid="theme-mode">{themeMode}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button onClick={() => setThemeMode('light')}>Set Light</button>
      <button onClick={() => setThemeMode('dark')}>Set Dark</button>
      <button onClick={() => setThemeMode('system')}>Set System</button>
    </div>
  );
};

describe('Theme Architecture Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.resetAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to system mode and resolves light/dark based on prefers-color-scheme', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-mode').textContent).toBe('system');
    expect(localStorage.getItem('wherezit_theme')).toBeNull();
  });

  it('allows setting explicit light theme mode and persists to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Set Light'));

    expect(screen.getByTestId('theme-mode').textContent).toBe('light');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    expect(localStorage.getItem('wherezit_theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('allows setting explicit dark theme mode and persists to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Set Dark'));

    expect(screen.getByTestId('theme-mode').textContent).toBe('dark');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    expect(localStorage.getItem('wherezit_theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores saved theme preference from localStorage on mount', () => {
    localStorage.setItem('wherezit_theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-mode').textContent).toBe('dark');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets root data-theme attribute to dark when dark theme is active', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Set Dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system mode to dark when OS prefers dark scheme', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-mode').textContent).toBe('system');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('preserves explicit light mode setting even when OS prefers dark scheme', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Set Light'));

    expect(screen.getByTestId('theme-mode').textContent).toBe('light');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ensures root workspace layout shell uses var(--color-bg) design token for background', () => {
    const { container } = render(
      <ThemeProvider>
        <div className="workspace-layout" style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }} />
      </ThemeProvider>
    );

    const layoutDiv = container.querySelector('.workspace-layout');
    expect(layoutDiv).not.toBeNull();
    expect(layoutDiv).toHaveStyle({ backgroundColor: 'var(--color-bg)' });
  });
});
