import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { useTheme, ThemeMode } from '../../../theme/ThemeContext';
import { ChangePasswordModal } from './ChangePasswordModal';

export const AccountMenu: React.FC = () => {
  const { user, signOut } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Ignore
    }
    window.location.href = '/login';
  };

  const userInitial = (user?.email?.[0] || 'U').toUpperCase();

  const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'system', label: 'System', icon: '💻' },
    { mode: 'light', label: 'Light', icon: '☀️' },
    { mode: 'dark', label: 'Dark', icon: '🌙' },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Avatar Icon Button */}
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        aria-label="Account"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#0284c7',
          color: '#ffffff',
          border: '2px solid #38bdf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '0.95rem',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          transition: 'all 150ms ease',
        }}
      >
        {userInitial}
      </button>

      {/* Account Menu Dropdown */}
      {isMenuOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            width: '260px',
            backgroundColor: 'var(--color-dropdown-bg, #ffffff)',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-dropdown-border, #e2e8f0)',
            boxShadow: 'var(--color-card-shadow, 0 10px 25px -5px rgba(15, 23, 42, 0.2))',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* User Email Header */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)', backgroundColor: 'var(--color-bg-subtle, #f8fafc)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase' }}>
              SIGNED IN AS
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || 'User'}
            </div>
          </div>

          {/* Change Password option */}
          <div style={{ padding: '0.375rem 0' }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsChangePasswordModalOpen(true);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text, #334155)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              🔒 Change Password
            </button>
          </div>

          {/* Appearance / Theme Selector Section */}
          <div style={{ borderTop: '1px solid var(--color-border-subtle, #f1f5f9)', padding: '0.625rem 1rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              APPEARANCE
            </div>
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--color-bg-subtle, #f1f5f9)',
                borderRadius: '0.5rem',
                padding: '0.2rem',
                gap: '0.25rem',
              }}
            >
              {themeOptions.map((opt) => {
                const isActive = themeMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setThemeMode(opt.mode)}
                    style={{
                      flex: 1,
                      padding: '0.35rem 0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '0.375rem',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--color-surface, #ffffff)' : 'transparent',
                      color: isActive ? 'var(--color-primary-text, #0284c7)' : 'var(--color-text-muted, #64748b)',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out */}
          <div style={{ borderTop: '1px solid var(--color-border-subtle, #f1f5f9)', padding: '0.375rem 0' }}>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--color-danger, #dc2626)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};
