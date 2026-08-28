import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintBoxLabelModal } from './components/PrintBoxLabelModal';

describe('PrintBoxLabelModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  it('renders BOX ID and box name without location in preview or print markup', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <PrintBoxLabelModal
        boxDisplayId="BOX 004"
        boxName="Camping Gear"
        locationPath="Bedroom -> Closet"
        isOpen={true}
        onClose={handleClose}
      />
    );

    // A. Box ID & Box Name rendered
    expect(screen.getByText('BOX 004')).toBeInTheDocument();
    expect(screen.getByText('Camping Gear')).toBeInTheDocument();
    expect(screen.getByText('WHEREZIT')).toBeInTheDocument();

    // B. Location is NOT rendered anywhere in DOM or print markup
    expect(screen.queryByText(/Bedroom/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Closet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/📍/i)).not.toBeInTheDocument();

    // C. Print-specific printable container does not contain location
    const printableCard = container.querySelector('.box-label-printable');
    expect(printableCard).toBeInTheDocument();
    expect(printableCard?.textContent).not.toContain('Bedroom');
    expect(printableCard?.textContent).toContain('BOX 004');
    expect(printableCard?.textContent).toContain('Camping Gear');
  });

  it('renders default fallback "Unnamed Box" when boxName is empty', () => {
    render(
      <PrintBoxLabelModal
        boxDisplayId="BOX 004"
        boxName=""
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('BOX 004')).toBeInTheDocument();
    expect(screen.getByText('Unnamed Box')).toBeInTheDocument();
    expect(screen.queryByText(/📍/i)).not.toBeInTheDocument();
  });

  it('uses standard medium buttons and handles close / print actions', () => {
    const handleClose = vi.fn();
    render(
      <PrintBoxLabelModal
        boxDisplayId="BOX 004"
        boxName="Tools"
        isOpen={true}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    const printBtn = screen.getByRole('button', { name: 'Print Label' });

    // E. Verify button classes
    expect(closeBtn.className).toContain('btn btn-secondary btn--md');
    expect(printBtn.className).toContain('btn btn-primary btn--md');

    // Test print action
    fireEvent.click(printBtn);
    expect(window.print).toHaveBeenCalledTimes(1);

    // Test close action
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
