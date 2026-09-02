import { describe, it, expect } from 'vitest';
import { getStorageSpaceDisplayName, formatSearchBreadcrumbDisplay } from './formatWorkspaceName';

describe('formatWorkspaceName Utility', () => {
  it('formats trailing Workspace from Storage Space names', () => {
    expect(getStorageSpaceDisplayName('Demo Home Workspace')).toBe('Demo Home');
    expect(getStorageSpaceDisplayName('Office Workspace')).toBe('Office');
    expect(getStorageSpaceDisplayName('PRIMARY WORKSPACE')).toBe('PRIMARY');
  });

  it('keeps names without trailing Workspace unchanged', () => {
    expect(getStorageSpaceDisplayName('Workspace Storage')).toBe('Workspace Storage');
    expect(getStorageSpaceDisplayName('My Workspace Room')).toBe('My Workspace Room');
  });

  it('handles conservative edge cases without returning empty strings', () => {
    expect(getStorageSpaceDisplayName('workspace')).toBe('workspace');
    expect(getStorageSpaceDisplayName('Workspace')).toBe('Workspace');
    expect(getStorageSpaceDisplayName('')).toBe('');
  });

  it('formats breadcrumbs prefixed with the Storage Space name', () => {
    expect(
      formatSearchBreadcrumbDisplay('Demo Home Workspace → Garage → Rack A → Shelf 1', 'Demo Home Workspace')
    ).toBe('Demo Home → Garage → Rack A → Shelf 1');

    expect(
      formatSearchBreadcrumbDisplay('Office Workspace › Attic › Box 1', 'Office Workspace')
    ).toBe('Office › Attic › Box 1');
  });

  it('leaves location breadcrumbs without the Storage Space name prefix unaltered', () => {
    expect(
      formatSearchBreadcrumbDisplay('Garage → Rack A → Shelf 1', 'Demo Home Workspace')
    ).toBe('Garage → Rack A → Shelf 1');
  });
});
