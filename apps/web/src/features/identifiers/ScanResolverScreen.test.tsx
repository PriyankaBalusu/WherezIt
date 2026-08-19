import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ScanResolverScreen } from './components/ScanResolverScreen';
import * as identifierApi from './api/identifierApi';
import * as useAuthModule from '../auth/useAuth';

vi.mock('./api/identifierApi');
vi.mock('../auth/useAuth');

describe('ScanResolverScreen (ID-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (tokenValue = 'wzi_qr_test123') => {
    return render(
      <MemoryRouter initialEntries={[`/scan/${tokenValue}`]}>
        <Routes>
          <Route path="/scan/:tokenValue" element={<ScanResolverScreen />} />
          <Route path="/login" element={<div>Login Screen</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('redirects unauthenticated user to login preserving return path in sessionStorage', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    renderWithRouter('wzi_qr_test123');

    await waitFor(() => {
      expect(screen.getByText('Login Screen')).toBeInTheDocument();
      expect(sessionStorage.getItem('returnPath')).toBe('/scan/wzi_qr_test123');
    });
  });

  it('resolves container details, breadcrumb, and trusted items for authenticated member', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com', emailVerified: true } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
      containerId: 'c-1',
      workspaceId: 'ws-1',
      boxNumber: 4,
      boxDisplayId: 'BOX 004',
      storageNodeId: 'node-1',
      locationName: 'Shelf 2',
      breadcrumbDisplay: 'Garage → Rack A → Shelf 2',
      items: [
        { itemId: 'item-1', name: 'Christmas Lights', quantity: 2 },
        { itemId: 'item-2', name: 'Extension Cord', quantity: 1 },
      ],
    });

    renderWithRouter('wzi_qr_test123');

    await waitFor(() => {
      expect(screen.getByText('BOX 004')).toBeInTheDocument();
      expect(screen.getByText(/Garage → Rack A → Shelf 2/i)).toBeInTheDocument();
      expect(screen.getByText('Christmas Lights')).toBeInTheDocument();
      expect(screen.getByText('×2')).toBeInTheDocument();
    });
  });

  it('renders sanitized unavailable state when token is invalid or unauthorized', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: { uid: 'user-2', email: 'nonmember@example.com', emailVerified: true } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    vi.mocked(identifierApi.resolveContainerIdentifier).mockRejectedValueOnce(
      new Error('Container not found or unavailable.')
    );

    renderWithRouter('wzi_qr_invalid');

    await waitFor(() => {
      expect(screen.getByText('Container Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Container not found or unavailable.')).toBeInTheDocument();
    });
  });
});
