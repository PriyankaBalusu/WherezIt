import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { ChangePasswordModal } from './ChangePasswordModal';

export const AccountMenu: React.FC = () => {
  const { user, signOut } = useAuth();
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
            width: '240px',
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* User Email Header */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              SIGNED IN AS
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || 'User'}
            </div>
          </div>

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
                color: '#334155',
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

          <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.375rem 0' }}>
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
                color: '#dc2626',
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
