import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileContainerDetailLayout } from './MobileContainerDetailLayout';

describe('Box Reference Photo Picker UX Consistency (BUG 12)', () => {
  const mockContainer = {
    id: 'box-123',
    workspaceId: 'ws-123',
    boxId: 'BOX 001',
    name: 'Test Box',
    description: 'Test Box Desc',
    storageNodeId: 'loc-123',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('1. Box Reference Photos display explicit Take Photo and Choose Photo buttons', () => {
    const handleCamera = vi.fn();
    const handleLibrary = vi.fn();

    render(
      <MobileContainerDetailLayout
        container={mockContainer as any}
        locationPathString="Garage"
        itemCount={0}
        photoCount={0}
        codeCount={0}
        workspaceId="ws-123"
        containerId="box-123"
        isOwner={true}
        referenceImages={[]}
        labelImage={null}
        identifiers={[]}
        isUploadingReference={false}
        onEditBox={vi.fn()}
        onMoveBox={vi.fn()}
        onArchiveBox={vi.fn()}
        onDeleteBox={vi.fn()}
        onTriggerPhotoUpload={vi.fn()}
        onTriggerReferenceCameraUpload={handleCamera}
        onTriggerReferenceLibraryUpload={handleLibrary}
        onOpenBoxLabel={vi.fn()}
        onOpenQr={vi.fn()}
        onOpenBarcode={vi.fn()}
        onOpenAttachMaster={vi.fn()}
        onOpenPhysicalLabel={vi.fn()}
        onOpenTakePhotoLabel={vi.fn()}
        onOpenRemoveExistingLabel={vi.fn()}
        onSetRevokeIdentifierTarget={vi.fn()}
        onSetPreviewImageUrl={vi.fn()}
        onSetGalleryIndex={vi.fn()}
        onSetImageToDelete={vi.fn()}
      />
    );

    // Switch to Photos tab
    const photosTab = screen.getByRole('tab', { name: /Photos/i });
    fireEvent.click(photosTab);

    // 1. Verify buttons exist
    const takeBtn = screen.getByRole('button', { name: /📷 Take Photo/i });
    const chooseBtn = screen.getByRole('button', { name: /📁 Choose Photo/i });

    expect(takeBtn).toBeInTheDocument();
    expect(chooseBtn).toBeInTheDocument();

    // 4. Clicking buttons invokes handlers
    fireEvent.click(takeBtn);
    expect(handleCamera).toHaveBeenCalledTimes(1);

    fireEvent.click(chooseBtn);
    expect(handleLibrary).toHaveBeenCalledTimes(1);
  });
});
