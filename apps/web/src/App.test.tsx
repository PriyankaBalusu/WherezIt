import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders app title and status', () => {
    render(<App />);
    expect(screen.getByText(/WherezIt Storage Memory/i)).toBeInTheDocument();
    expect(screen.getByText(/System Status/i)).toBeInTheDocument();
  });
});
