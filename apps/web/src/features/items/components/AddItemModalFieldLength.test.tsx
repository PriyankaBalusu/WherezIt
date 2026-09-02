import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddItemModal } from './AddItemModal';

describe('AddItemModal Field Length Validation (BUG 11)', () => {
  it('5 & 6 & 7. Input elements have correct maxLength attributes and validate over-length input', () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <AddItemModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Christmas Lights/i);
    const categoryInput = screen.getByPlaceholderText(/Holiday Decor/i);

    // 5. Verify maxLength attributes exist
    expect(nameInput).toHaveAttribute('maxLength', '100');
    expect(categoryInput).toHaveAttribute('maxLength', '50');

    // 6. Over-length input shows friendly error message when submitted
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));

    expect(screen.getByText(/Item name must be 100 characters or fewer./i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
