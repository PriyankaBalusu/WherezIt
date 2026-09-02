import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'wherezit_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSavedThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // LocalStorage unavailable
  }
  return 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getSavedThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const mode = getSavedThemeMode();
    return mode === 'system' ? getSystemTheme() : mode;
  });

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // LocalStorage error fallback
    }
  };

  useEffect(() => {
    const updateTheme = () => {
      const active = themeMode === 'system' ? getSystemTheme() : themeMode;
      setResolvedTheme(active);
      document.documentElement.setAttribute('data-theme', active);
    };

    updateTheme();

    if (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        updateTheme();
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
