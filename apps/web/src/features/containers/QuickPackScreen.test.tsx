import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QuickPackScreen } from './QuickPackScreen';
import * as containerApi from './api/containerApi';
import * as identifierApi from '../identifiers/api/identifierApi';
import * as locationsHooks from '../locations/hooks/useStorageLocations';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

const mockActiveWorkspaceId = {
  id: 'ws-1',
  name: 'Garage space',
  role: 'OWNER' as const,
  createdAt: '2026-08-15T00:00:00Z',
  inventoryNamespaceId: 'ns-1',
};
const mockSetActiveWorkspaceId = vi.fn();

vi.mock('../workspaces/context/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaces: [
      { id: 'ws-1', name: 'Garage space', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z', inventoryNamespaceId: 'ns-1' },
      { id: 'ws-other', name: 'Other space', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z', inventoryNamespaceId: 'ns-1' },
      { id: 'ws-cross', name: 'Cross space', role: 'OWNER', createdAt: '2026-08-15T00:00:00Z', inventoryNamespaceId: 'ns-2' },
    ],
    activeWorkspace: mockActiveWorkspaceId,
    setActiveWorkspaceId: mockSetActiveWorkspaceId,
  }),
}));

vi.mock('../workspaces/components/CreateWorkspaceModal', () => ({
  CreateWorkspaceModal: ({ isOpen, onCreated, onClose }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="mock-create-workspace-modal">
        <button type="button" onClick={() => onCreated('ws-other')}>
          Simulate Create Workspace
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  },
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    getIdToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));

vi.mock('../locations/hooks/useStorageLocations', () => ({
  useStorageLocations: () => ({
    data: [
      { id: 'loc-1', name: 'Bedroom', parentId: null },
      { id: 'loc-2', name: 'Kitchen', parentId: null },
      { id: 'loc-dest', name: 'Moving Truck', parentId: null },
    ],
    isLoading: false,
  }),
  useCreateStorageLocation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'loc-new', name: 'New Location', parentId: null }),
    isPending: false,
  }),
}));

vi.mock('./hooks/useContainers', () => ({
  useContainers: () => ({
    data: [
      { id: 'cont-004', boxNumber: 4, boxDisplayId: 'BOX 004', name: 'Kitchen Appliances', storageNodeId: 'loc-1', isArchived: false, movingPriority: 'HIGH', isPacked: true, workspaceId: 'ws-1' },
      { id: 'cont-007', boxNumber: 7, boxDisplayId: 'BOX 007', name: 'Camping Gear', storageNodeId: 'loc-2', isArchived: false, movingPriority: null, isPacked: false, workspaceId: 'ws-1' },
      { id: 'cont-012', boxNumber: 12, boxDisplayId: 'BOX 012', name: 'Holiday Items', storageNodeId: 'loc-dest', isArchived: false, movingPriority: 'LOW', isPacked: false, workspaceId: 'ws-1' },
    ],
  }),
}));

vi.mock('./api/containerApi', () => ({
  createContainer: vi.fn().mockResolvedValue({
    id: 'cont-999',
    workspaceId: 'ws-1',
    storageNodeId: 'loc-1',
    boxNumber: 10,
    boxDisplayId: 'BOX 010',
    name: 'Pack Box Test',
    description: null,
    isArchived: false,
    destinationStorageNodeId: 'loc-2',
    isPacked: true,
    movingPriority: 'HIGH',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateContainer: vi.fn().mockResolvedValue({}),
  moveContainer: vi.fn().mockResolvedValue({}),
  transferContainer: vi.fn().mockResolvedValue({}),
  unpackContainer: vi.fn().mockResolvedValue({}),
  fetchContainer: vi.fn().mockResolvedValue({
    id: 'cont-foreign',
    boxNumber: 20,
    boxDisplayId: 'BOX 020',
    name: 'Foreign Box',
    storageNodeId: 'loc-1',
    isArchived: false,
  }),
}));

vi.mock('../identifiers/api/identifierApi', () => ({
  resolveContainerIdentifier: vi.fn(),
}));

vi.mock('../images/utils/compressImage', () => ({
  compressImage: vi.fn().mockImplementation((file) => Promise.resolve({
    file,
    compressed: false,
    originalSize: file.size,
    compressedSize: file.size,
  })),
}));

describe('QuickPackScreen Phase 2 (Landing, Pack a Box, Move Boxes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue('mock-object-url');
  });

  it('1: landing shows Pack a Box + Move Boxes options', () => {
    render(
      <MemoryRouter>
        <QuickPackScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('Moving Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pack a Box$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Move Boxes$/i })).toBeInTheDocument();
  });

  it('2: Pack a Box still works', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=PACK_BOX']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Where is this box?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Current location/i), { target: { value: 'loc-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2
    expect(screen.getByText("What's inside?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    // Step 3
    expect(screen.getByText('Finish this box')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Box' }));

    await waitFor(() => {
      expect(containerApi.createContainer).toHaveBeenCalledTimes(1);
    });
  });

  it('3-7: Move Boxes workflow steps - select boxes, handle duplicates, cross-workspace warning and switch context', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Which boxes are you moving?')).toBeInTheDocument();

    // Check multiple checkboxes
    const cb1 = screen.getByLabelText(/BOX 004/i);
    const cb2 = screen.getByLabelText(/BOX 007/i);
    fireEvent.click(cb1);
    fireEvent.click(cb2);

    expect(screen.getByText('Selected Boxes (2)')).toBeInTheDocument();

    // Trigger CodeScanner scan for duplicate box
    fireEvent.click(screen.getByRole('button', { name: /Scan a Box/i }));
    
    // Simulate manual duplicate resolution
    vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
      containerId: 'cont-004',
      workspaceId: 'ws-1',
      boxNumber: 4,
      boxDisplayId: 'BOX 004',
      storageNodeId: 'loc-1',
      locationName: 'Bedroom',
      breadcrumbDisplay: 'Bedroom',
      items: [],
    });

    const manualInput = screen.getByPlaceholderText(/Enter QR or barcode/i);
    fireEvent.change(manualInput, { target: { value: 'wzi_qr_004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find Box' }));

    await waitFor(() => {
      expect(screen.getByText('BOX 004 is already selected.')).toBeInTheDocument();
    });

    // Simulate manual resolution for a foreign workspace box
    vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
      containerId: 'cont-foreign',
      workspaceId: 'ws-other',
      boxNumber: 20,
      boxDisplayId: 'BOX 020',
      storageNodeId: 'loc-1',
      locationName: 'Office',
      breadcrumbDisplay: 'Office',
      items: [],
    });

    fireEvent.change(manualInput, { target: { value: 'wzi_qr_foreign' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find Box' }));

    await waitFor(() => {
      expect(screen.getByText('Switch Storage Space?')).toBeInTheDocument();
    });

    // Confirm switch workspace
    fireEvent.click(screen.getByRole('button', { name: 'Switch Storage Space' }));
    expect(mockSetActiveWorkspaceId).toHaveBeenCalledWith('ws-other');
  });

  it('8-12: Move Boxes Step 2 & Step 3 execution flow (requires destination, move-before-priority, partial status retry)', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          <Route path="/workspaces/:workspaceId" element={<div>Workspace Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1: Select BOX 004 and BOX 007
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByLabelText(/BOX 007/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Choose Destination
    expect(screen.getByText('Where are these boxes going?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Destination Storage Location/i), { target: { value: 'loc-dest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Review Move
    expect(screen.getByText('Review Move')).toBeInTheDocument();
    expect(screen.getByText(/Moving 2 box\(es\) to:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Moving Truck/i)[0]).toBeInTheDocument();

    // Verify visual priorities
    const box4Buttons = screen.getAllByRole('button', { name: 'Open first' });
    expect(box4Buttons[0]).toBeInTheDocument(); // BOX 004 priority is HIGH

    const box7Buttons = screen.getAllByRole('button', { name: 'Normal' });
    expect(box7Buttons[1]).toBeInTheDocument(); // BOX 007 priority is null (shows Normal)

    // Edit BOX 007 priority to Open first
    const box7OpenFirst = screen.getAllByRole('button', { name: 'Open first' })[1];
    fireEvent.click(box7OpenFirst);

    // Setup Move mock execution (simulate partial failure where BOX 004 succeeds but BOX 007 move fails)
    vi.mocked(containerApi.moveContainer).mockImplementation(({}, containerId) => {
      if (containerId === 'cont-007') {
        return Promise.reject(new Error('Failed to move camping gear'));
      }
      return Promise.resolve({} as any);
    });

    // Execute Move
    fireEvent.click(screen.getByRole('button', { name: 'Move 2 Boxes' }));

    await waitFor(() => {
      // BOX 004 succeeded
      expect(containerApi.moveContainer).toHaveBeenCalledWith('ws-1', 'cont-004', 'loc-dest', expect.any(Function));
      // BOX 007 failed
      expect(containerApi.moveContainer).toHaveBeenCalledWith('ws-1', 'cont-007', 'loc-dest', expect.any(Function));
      // updateContainer only called for BOX 004 since BOX 007 move failed (move-before-priority enforcer)
      expect(containerApi.updateContainer).not.toHaveBeenCalledWith('ws-1', 'cont-007', expect.any(Object), expect.any(Function));
      
      // Partial success alert message
      expect(screen.getByText(/1 box\(es\) moved, 1 box\(es\) couldn't be moved/i)).toBeInTheDocument();
      expect(screen.getByText('Couldn\'t be moved')).toBeInTheDocument();
    });
  });

  it('A-AD: Move Boxes - filters Destination Storage Spaces by same-Inventory namespace membership', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1: Select BOX 004
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Choose Destination
    expect(screen.getByText('Where are these boxes going?')).toBeInTheDocument();

    // Verify workspace selector contains same-inventory workspace (Other space) but NOT cross-inventory workspace (Cross space)
    const selectWs = screen.getByLabelText(/Destination Storage Space/i) as HTMLSelectElement;
    const options = Array.from(selectWs.options).map((opt) => opt.text);
    expect(options).toContain('Garage space');
    expect(options).toContain('Other space');
    expect(options).not.toContain('Cross space');
  });

  it('AE: Move Boxes - supports cross-space transfer endpoint and targets destination workspace for priority update', async () => {
    vi.mocked(containerApi.transferContainer).mockResolvedValue({} as any);

    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          <Route path="/workspaces/:workspaceId" element={<div>Workspace Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1: Select BOX 004
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Select other destination workspace (ws-other) and location (loc-dest)
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-other' } });
    fireEvent.change(screen.getByLabelText(/Destination Storage Location/i), { target: { value: 'loc-dest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Verify and execute
    expect(screen.getByText('Review Move')).toBeInTheDocument();

    // Edit BOX 004 priority to Normal (MEDIUM) to trigger priority update PATCH
    fireEvent.click(screen.getByRole('button', { name: 'Normal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Move Box' }));

    await waitFor(() => {
      // Must call transferContainer (cross-space) targeting sourceInventoryNamespaceId = ns-1, destinationWorkspaceId = ws-other
      expect(containerApi.transferContainer).toHaveBeenCalledWith(
        'ns-1',
        'cont-004',
        'ws-other',
        'loc-dest',
        expect.any(Function)
      );

      // Must call updateContainer on the destination workspace (ws-other)
      expect(containerApi.updateContainer).toHaveBeenCalledWith(
        'ws-other',
        'cont-004',
        { movingPriority: 'MEDIUM' },
        expect.any(Function)
      );
    });
  });

  it('AF: Move Boxes - supports adding a new storage space inline inside the same Inventory Namespace', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1: Select BOX 004
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Open Create Storage Space
    fireEvent.click(screen.getByRole('button', { name: '+ Add Storage Space' }));
    
    // Check mock modal is visible
    expect(screen.getByTestId('mock-create-workspace-modal')).toBeInTheDocument();

    // Click mock modal workspace create button (simulates workspace creation callback returning 'ws-new')
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Create Workspace' }));

    await waitFor(() => {
      // The destination workspace should now select the new workspace
      const selectWs = screen.getByLabelText(/Destination Storage Space/i) as HTMLSelectElement;
      expect(selectWs.value).toBe('ws-other');
    });
  });

  it('AG: Move Boxes - targets destination workspace when creating an inline storage location in Step 2', async () => {
    const spy = vi.spyOn(locationsHooks, 'useCreateStorageLocation');

    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1: Select BOX 004
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Select ws-other workspace, which triggers no locations yet empty state
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-other' } });
    
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('ws-other');
    });
  });

  it('AH: Move Boxes - successful transfer displays Done and Open Destination buttons, switching context only on click', async () => {
    vi.mocked(containerApi.transferContainer).mockResolvedValue({} as any);

    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          <Route path="/workspaces/:workspaceId" element={<div>Workspace Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Choose Destination ws-other
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-other' } });
    fireEvent.change(screen.getByLabelText(/Destination Storage Location/i), { target: { value: 'loc-dest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Execute Move
    fireEvent.click(screen.getByRole('button', { name: 'Move Box' }));

    await waitFor(() => {
      // Check success message displays workspace / location
      expect(screen.getByText(/boxes moved successfully to Other space \/ Moving Truck/i)).toBeInTheDocument();
      // Check buttons
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open Destination' })).toBeInTheDocument();
    });

    // Verify context switcher was NOT called yet (does not switch during select/review)
    expect(mockSetActiveWorkspaceId).not.toHaveBeenCalled();

    // Click Open Destination
    fireEvent.click(screen.getByRole('button', { name: 'Open Destination' }));
    expect(mockSetActiveWorkspaceId).toHaveBeenCalledWith('ws-other');
  });

  it('AI: Move Boxes - Selected destination location renders its correct path on Review Move', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-1' } });
    fireEvent.change(screen.getByLabelText(/Destination Storage Location/i), { target: { value: 'loc-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3
    expect(screen.getByText('Review Move')).toBeInTheDocument();
    expect(screen.getByText(/Moving 1 box\(es\) to:/i)).toBeInTheDocument();
    const matches = screen.getAllByText(/Garage space \/ Kitchen/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('AJ: Move Boxes - A missing required destination location prevents Step 3', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-1' } });
    fireEvent.change(screen.getByLabelText(/Destination Storage Location/i), { target: { value: '' } });
    
    // Check that Continue is disabled
    const continueBtn = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);
  });

  it('AK: Move Boxes - creating a child storage location targets destination workspace and passes parentId', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'loc-child-new', name: 'New Sub-location', parentId: 'loc-1' });
    vi.spyOn(locationsHooks, 'useCreateStorageLocation').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Choose Destination ws-other
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-other' } });
    
    // Click Add Storage Location
    fireEvent.click(screen.getByRole('button', { name: '+ Add Storage Location' }));
    
    // Fill form with parentId
    fireEvent.change(screen.getByLabelText(/Location Name \*/i), { target: { value: 'Left Wall' } });
    fireEvent.change(screen.getByLabelText(/Belongs inside \(Optional\)/i), { target: { value: 'loc-dest' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'Left Wall',
        parentId: 'loc-dest',
      });
    });
  });

  it('AL: Move Boxes - Changing destination workspace clears destination location selection', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=MOVE_BOXES']}>
        <Routes>
          <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.click(screen.getByLabelText(/BOX 004/i));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-1' } });
    fireEvent.change(screen.getByLabelText(/Destination Storage Location/i), { target: { value: 'loc-2' } });

    // Verify it is selected
    const selectLoc = screen.getByLabelText(/Destination Storage Location/i) as HTMLSelectElement;
    expect(selectLoc.value).toBe('loc-2');

    // Switch workspace
    fireEvent.change(screen.getByLabelText(/Destination Storage Space/i), { target: { value: 'ws-other' } });

    // Verify it has been cleared
    await waitFor(() => {
      const selectLocUpdated = screen.getByLabelText(/Destination Storage Location/i) as HTMLSelectElement;
      expect(selectLocUpdated.value).toBe('');
    });
  });

  describe('Moving Assistant Phase 3 - Unpack', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('A, B, C: Landing shows three workflows and buttons operate normally', () => {
      render(
        <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('📦 Pack a Box')).toBeInTheDocument();
      expect(screen.getByText('🚚 Move Boxes')).toBeInTheDocument();
      expect(screen.getByText('🔓 Unpack')).toBeInTheDocument();

      // Check Pack button clicks
      fireEvent.click(screen.getAllByRole('button', { name: 'Pack a Box' })[0] || screen.getByRole('button', { name: 'Pack a Box' }));
      expect(screen.getByRole('heading', { name: /Pack a Box/i })).toBeInTheDocument();
    });

    it('D, E, F, G, H, I, J: Step 1 renders list with correct sorting, pathing, and filters unpacked boxes', () => {
      render(
        <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=UNPACK']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify header and scan box button exists
      expect(screen.getByRole('heading', { name: /Which box are you unpacking\?/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Scan a Box/i })).toBeInTheDocument();

      // Mock containers returned:
      // Kitchen Appliances (Box 4, Packed: true, Priority: HIGH) -> displayed
      // Camping Gear (Box 7, Packed: false, Priority: null) -> excluded
      // Holiday Items (Box 12, Packed: false, Priority: LOW) -> excluded
      expect(screen.queryByText(/Camping Gear/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Holiday Items/i)).not.toBeInTheDocument();

      const choiceRow = screen.getByText(/Kitchen Appliances/i);
      expect(choiceRow).toBeInTheDocument();
      // Check current Storage Space + Location display
      expect(screen.getByText(/Garage space \/ Bedroom/i)).toBeInTheDocument();
      expect(screen.getByText('Open first')).toBeInTheDocument();
    });

    it('K, L, P, Q, R, S, T: Scan selects box, navigates to Step 2, and Mark as Unpacked triggers unpackContainer', async () => {
      vi.mocked(containerApi.fetchContainer).mockResolvedValue({
        id: 'cont-004',
        workspaceId: 'ws-1',
        storageNodeId: 'loc-1',
        boxNumber: 4,
        boxId: 'BOX 004',
        name: 'Kitchen Appliances',
        isPacked: true,
        movingPriority: 'HIGH',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(containerApi.unpackContainer).mockResolvedValue({} as any);

      render(
        <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=UNPACK']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          </Routes>
        </MemoryRouter>
      );

      // Show scanner
      fireEvent.click(screen.getByRole('button', { name: /Scan a Box/i }));
      
      // Simulate scan resolution
      vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
        containerId: 'cont-004',
        workspaceId: 'ws-1',
        boxNumber: 4,
        boxDisplayId: 'BOX 004',
        storageNodeId: 'loc-1',
        locationName: 'Kitchen Appliances',
        breadcrumbDisplay: 'Bedroom',
        items: [],
      });
      const manualInput = screen.getByPlaceholderText(/Enter QR or barcode/i);
      fireEvent.change(manualInput, { target: { value: 'wzi_qr_004' } });
      fireEvent.click(screen.getByRole('button', { name: 'Find Box' }));

      // Verify Step 2 Confirm page is displayed
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Ready to unpack this box\?/i })).toBeInTheDocument();
        expect(screen.getByText('BOX 004')).toBeInTheDocument();
        expect(screen.getByText('Kitchen Appliances')).toBeInTheDocument();
        expect(screen.getByText('Garage space / Bedroom')).toBeInTheDocument();
      });

      // Click Mark as Unpacked
      const unpackBtn = screen.getByRole('button', { name: 'Mark as Unpacked' });
      fireEvent.click(unpackBtn);

      await waitFor(() => {
        expect(containerApi.unpackContainer).toHaveBeenCalledWith('ws-1', 'cont-004', expect.any(Function));
        expect(screen.getByText(/BOX 004 is unpacked\./i)).toBeInTheDocument();
      });
    });

    it('M: Already-unpacked scan shows warning and View Box button', async () => {
      vi.mocked(containerApi.fetchContainer).mockResolvedValue({
        id: 'cont-007',
        workspaceId: 'ws-1',
        storageNodeId: 'loc-2',
        boxNumber: 7,
        boxId: 'BOX 007',
        name: 'Camping Gear',
        isPacked: false,
        movingPriority: null,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=UNPACK']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Scan a Box/i }));
      
      vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
        containerId: 'cont-007',
        workspaceId: 'ws-1',
        boxNumber: 7,
        boxDisplayId: 'BOX 007',
        storageNodeId: 'loc-2',
        locationName: 'Camping Gear',
        breadcrumbDisplay: 'Camping Gear',
        items: [],
      });
      const manualInput = screen.getByPlaceholderText(/Enter QR or barcode/i);
      fireEvent.change(manualInput, { target: { value: 'wzi_qr_007' } });
      fireEvent.click(screen.getByRole('button', { name: 'Find Box' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Box Already Unpacked/i })).toBeInTheDocument();
        expect(screen.getByText(/is already unpacked\./i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View Box' })).toBeInTheDocument();
      });

      expect(containerApi.unpackContainer).not.toHaveBeenCalled();
    });

    it('O: Cross-workspace scan shows confirmation dialog and uses actual workspace context', async () => {
      vi.mocked(containerApi.fetchContainer).mockResolvedValue({
        id: 'cont-foreign',
        workspaceId: 'ws-other',
        storageNodeId: 'loc-dest',
        boxNumber: 20,
        boxId: 'BOX 020',
        name: 'Foreign Box',
        isPacked: true,
        movingPriority: 'MEDIUM',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(containerApi.unpackContainer).mockResolvedValue({} as any);

      render(
        <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=UNPACK']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Scan a Box/i }));
      
      vi.mocked(identifierApi.resolveContainerIdentifier).mockResolvedValueOnce({
        containerId: 'cont-foreign',
        workspaceId: 'ws-other',
        boxNumber: 20,
        boxDisplayId: 'BOX 020',
        storageNodeId: 'loc-dest',
        locationName: 'Foreign Box',
        breadcrumbDisplay: 'Foreign Box',
        items: [],
      });
      const manualInput = screen.getByPlaceholderText(/Enter QR or barcode/i);
      fireEvent.change(manualInput, { target: { value: 'wzi_qr_foreign' } });
      fireEvent.click(screen.getByRole('button', { name: 'Find Box' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Box in Another Storage Space/i })).toBeInTheDocument();
        expect(screen.getByText(/This box is in/i)).toBeInTheDocument();
      });

      // Confirm switch/continue
      fireEvent.click(screen.getByRole('button', { name: 'Continue with this box' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Ready to unpack this box\?/i })).toBeInTheDocument();
      });

      // Click Mark as Unpacked
      fireEvent.click(screen.getByRole('button', { name: 'Mark as Unpacked' }));

      await waitFor(() => {
        // Assert that the unpacked container API calls the actual workspaceId ws-other
        expect(containerApi.unpackContainer).toHaveBeenCalledWith('ws-other', 'cont-foreign', expect.any(Function));
      });
    });

    it('X, Y, Z, AA: Success actions navigate and Done does not switch context', async () => {
      vi.mocked(containerApi.fetchContainer).mockResolvedValue({
        id: 'cont-004',
        workspaceId: 'ws-1',
        storageNodeId: 'loc-1',
        boxNumber: 4,
        boxId: 'BOX 004',
        name: 'Kitchen Appliances',
        isPacked: true,
        movingPriority: 'HIGH',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(containerApi.unpackContainer).mockResolvedValue({} as any);

      render(
        <MemoryRouter initialEntries={['/workspaces/ws-1/quick-pack?workflow=UNPACK']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/quick-pack" element={<QuickPackScreen />} />
            <Route path="/workspaces/:workspaceId/containers/:containerId" element={<div>Box Details Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Select row directly
      fireEvent.click(screen.getByText('Kitchen Appliances'));
      fireEvent.click(screen.getByRole('button', { name: 'Mark as Unpacked' }));

      await waitFor(() => {
        expect(screen.getByText(/BOX 004 is unpacked\./i)).toBeInTheDocument();
      });

      // Click Unpack Another Box -> goes back to Step 1
      fireEvent.click(screen.getByRole('button', { name: 'Unpack Another Box' }));
      expect(screen.getByRole('heading', { name: /Which box are you unpacking\?/i })).toBeInTheDocument();

      // Select again and unpack
      fireEvent.click(screen.getByText('Kitchen Appliances'));
      fireEvent.click(screen.getByRole('button', { name: 'Mark as Unpacked' }));

      await waitFor(() => {
        expect(screen.getByText(/BOX 004 is unpacked\./i)).toBeInTheDocument();
      });

      // Click Done -> returns to landing page, context remains unchanged
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.getByText('📦 Pack a Box')).toBeInTheDocument();
      expect(mockSetActiveWorkspaceId).not.toHaveBeenCalled();

      // Click Unpack again to go back to success
      fireEvent.click(screen.getAllByRole('button', { name: 'Unpack' })[0]);
      fireEvent.click(screen.getByText('Kitchen Appliances'));
      fireEvent.click(screen.getByRole('button', { name: 'Mark as Unpacked' }));

      await waitFor(() => {
        expect(screen.getByText(/BOX 004 is unpacked\./i)).toBeInTheDocument();
      });

      // Click View Box
      fireEvent.click(screen.getByRole('button', { name: 'View Box' }));
      expect(screen.getByText('Box Details Screen')).toBeInTheDocument();
    });
  });
});
