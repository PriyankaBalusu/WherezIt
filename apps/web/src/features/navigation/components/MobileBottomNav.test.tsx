import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';

vi.mock('../../workspaces/context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    activeWorkspace: { id: 'ws-123', name: 'Test Space' },
  }),
}));

describe('MobileBottomNav Navigation Routing (Mobile Move Footer Fix)', () => {
  it('1 & 2. Mobile Move footer button points to Moving Assistant landing page (/move) and not directly to MOVE_BOXES', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>
    );

    const moveLink = screen.getByRole('link', { name: /Move/i });
    expect(moveLink).toHaveAttribute('href', '/move');
    expect(moveLink.getAttribute('href')).not.toContain('workflow=MOVE_BOXES');
  });

  it('3. Home, Search, and Scan footer navigation links remain unchanged', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole('link', { name: /Home/i });
    const searchLink = screen.getByRole('link', { name: /Search/i });
    const scanLink = screen.getByRole('link', { name: /Scan/i });

    expect(homeLink).toHaveAttribute('href', '/');
    expect(searchLink).toHaveAttribute('href', '/search');
    expect(scanLink).toHaveAttribute('href', '/scan');
  });
});
