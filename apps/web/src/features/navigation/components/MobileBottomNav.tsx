import React from 'react';
import { NavLink } from 'react-router-dom';
import './MobileBottomNav.css';

export const MobileBottomNav: React.FC = () => {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main mobile navigation">
      <NavLink
        to="/"
        className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        end
      >
        <span className="mobile-bottom-nav-icon">🏠</span>
        <span className="mobile-bottom-nav-label">Home</span>
      </NavLink>

      <NavLink
        to="/search"
        className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="mobile-bottom-nav-icon">🔍</span>
        <span className="mobile-bottom-nav-label">Search</span>
      </NavLink>

      <NavLink
        to="/move"
        className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="mobile-bottom-nav-icon">🚚</span>
        <span className="mobile-bottom-nav-label">Move</span>
      </NavLink>

      <NavLink
        to="/scan"
        className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="mobile-bottom-nav-icon">📷</span>
        <span className="mobile-bottom-nav-label">Scan</span>
      </NavLink>
    </nav>
  );
};
