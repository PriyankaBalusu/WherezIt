import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HierarchicalLocationPicker } from '../HierarchicalLocationPicker';
import { StorageLocation } from '../../types/location';

const mockLocations: StorageLocation[] = [
  { id: 'loc-1', name: 'Garage', parentId: null, workspaceId: 'ws-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'loc-2', name: 'Rack A', parentId: 'loc-1', workspaceId: 'ws-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'loc-3', name: 'Shelf 1', parentId: 'loc-2', workspaceId: 'ws-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
];

describe('HierarchicalLocationPicker Component', () => {
  it('renders button trigger with selected location breadcrumb or default title', () => {
    render(
      <HierarchicalLocationPicker
        locations={mockLocations}
        selectedLocationId="loc-2"
        onSelectLocation={vi.fn()}
        title="Select Current Location"
        allowAll={false}
      />
    );

    expect(screen.getByRole('button', { name: /Garage › Rack A/i })).toBeDefined();
  });

  it('opens modal dialog when trigger button is clicked', () => {
    render(
      <HierarchicalLocationPicker
        locations={mockLocations}
        selectedLocationId={null}
        onSelectLocation={vi.fn()}
        title="Select Current Location"
        allowAll={false}
        buttonLabel="-- Select Current Location --"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /-- Select Current Location --/i }));

    expect(screen.getByText('Select Current Location')).toBeDefined();
    expect(screen.getByText('Garage')).toBeDefined();
  });

  it('supports drilling down into sublocations', () => {
    render(
      <HierarchicalLocationPicker
        locations={mockLocations}
        selectedLocationId={null}
        onSelectLocation={vi.fn()}
        title="Select Current Location"
        allowAll={false}
        buttonLabel="-- Select Current Location --"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /-- Select Current Location --/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sublocations ›/i }));

    expect(screen.getByText('Rack A')).toBeDefined();
  });

  it('calls onSelectLocation and closes modal when a location is chosen', () => {
    const handleSelect = vi.fn();

    render(
      <HierarchicalLocationPicker
        locations={mockLocations}
        selectedLocationId={null}
        onSelectLocation={handleSelect}
        title="Select Current Location"
        allowAll={false}
        buttonLabel="-- Select Current Location --"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /-- Select Current Location --/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Garage$/i }));

    expect(handleSelect).toHaveBeenCalledWith('loc-1');
  });

  it('renders only one canonical All Locations control at root and excludes duplicate button/header', () => {
    const handleSelect = vi.fn();

    render(
      <HierarchicalLocationPicker
        locations={mockLocations}
        selectedLocationId={null}
        onSelectLocation={handleSelect}
        title="Filter by Location"
        allowAll={true}
        buttonLabel="All Locations"
      />
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /^All Locations$/i }));

    // 1. Verify "Select All Locations" button is NO LONGER rendered
    expect(screen.queryByRole('button', { name: /Select All Locations/i })).toBeNull();

    // 2. Verify exactly one visible "All Locations" control exists (the selectable row)
    const allLocationsElements = screen.getAllByText(/All Locations/i);
    expect(allLocationsElements.length).toBe(1);

    // 3. Verify selecting "All Locations" row calls onSelectLocation(null)
    fireEvent.click(allLocationsElements[0]);
    expect(handleSelect).toHaveBeenCalledWith(null);
  });
});
