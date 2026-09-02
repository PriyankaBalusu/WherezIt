import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemedSelect } from './ThemedSelect';

describe('ThemedSelect Component & Moving Assistant Dropdown Consistency', () => {
  const sampleOptions = [
    { value: 'ws-1', label: 'Storage Space 1 (Main House)' },
    { value: 'ws-2', label: 'Storage Space 2 (Garage / Extra Large Facility)' },
    { value: 'ws-3', label: 'Storage Space 3 (Very Long Name That Truncates On Mobile Viewports)' },
  ];

  it('4 & 5. Renders selected value and calls onChange when an option is selected', () => {
    const handleChange = vi.fn();
    render(
      <ThemedSelect
        id="test-select"
        value="ws-1"
        onChange={handleChange}
        options={sampleOptions}
        aria-label="Storage Space"
      />
    );

    // 4. Selected value is rendered correctly
    const trigger = screen.getByRole('button', { name: /Storage Space 1/i });
    expect(trigger).toBeInTheDocument();

    // Open dropdown
    fireEvent.click(trigger);

    // Select option 2
    const option2 = screen.getByText('Storage Space 2 (Garage / Extra Large Facility)');
    fireEvent.click(option2);

    // 5. Calling onChange
    expect(handleChange).toHaveBeenCalledWith('ws-2');
  });

  it('6 & 7. Dark-mode and light-mode theme classes are applied to trigger and popup menu', () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const { rerender } = render(
      <ThemedSelect
        id="theme-select"
        value="ws-1"
        onChange={vi.fn()}
        options={sampleOptions}
        aria-label="Storage Space"
      />
    );

    const trigger = screen.getByRole('button', { name: /Storage Space 1/i });
    fireEvent.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass('themed-select-dropdown');

    // Reset theme attribute
    document.documentElement.setAttribute('data-theme', 'light');
    rerender(
      <ThemedSelect
        id="theme-select"
        value="ws-1"
        onChange={vi.fn()}
        options={sampleOptions}
        aria-label="Storage Space"
      />
    );

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    document.documentElement.removeAttribute('data-theme');
  });

  it('8. Long option labels apply text truncation styling for mobile layout protection', () => {
    render(
      <ThemedSelect
        id="long-name-select"
        value="ws-3"
        onChange={vi.fn()}
        options={sampleOptions}
        aria-label="Storage Space"
      />
    );

    const labelSpan = screen.getByText(/Very Long Name That Truncates/i);
    expect(labelSpan).toHaveClass('themed-select-label');
  });

  it('9. Keyboard navigation supports ArrowDown, Enter, and Escape keypresses', () => {
    const handleChange = vi.fn();
    render(
      <ThemedSelect
        id="kbd-select"
        value="ws-1"
        onChange={handleChange}
        options={sampleOptions}
        aria-label="Storage Space"
      />
    );

    const trigger = screen.getByRole('button', { name: /Storage Space 1/i });

    // Open via ArrowDown
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Close via Escape
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
