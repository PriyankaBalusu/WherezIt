import React, { useState, useRef, useEffect } from 'react';
import './ThemedSelect.css';

export interface ThemedSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ThemedSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const ThemedSelect: React.FC<ThemedSelectProps> = ({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = '-- Select --',
  disabled = false,
  className = '',
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Keep focused item scrolled into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listboxRef.current) {
      const optionEl = listboxRef.current.children[focusedIndex] as HTMLElement;
      if (optionEl) {
        optionEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  };

  const handleSelectOption = (option: ThemedSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        const idx = options.findIndex((opt) => opt.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          handleSelectOption(options[focusedIndex]);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="themed-select-container" style={style}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`themed-select-trigger ${className}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <span className={`themed-select-label ${!selectedOption ? 'themed-select-placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`themed-select-arrow ${isOpen ? 'themed-select-arrow--open' : ''}`}>▼</span>
      </button>

      {/* Hidden select element for form compatibility and test query support */}
      <select
        tabIndex={-1}
        aria-hidden="true"
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {isOpen && (
        <div
          ref={listboxRef}
          className="themed-select-dropdown"
          role="listbox"
          id={id ? `${id}-listbox` : undefined}
          tabIndex={-1}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isFocused = idx === focusedIndex;

            return (
              <div
                key={option.value || idx}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                className={`themed-select-option ${isSelected ? 'themed-select-option--selected' : ''} ${isFocused ? 'themed-select-option--focused' : ''}`}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span className="themed-select-option-text">{option.label}</span>
                {isSelected && <span className="themed-select-checkmark">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
