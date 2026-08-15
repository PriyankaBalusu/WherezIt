import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders login form for unauthenticated users by default', async () => {
    render(<App />);
    expect(await screen.findByText(/Sign In to WherezIt/i)).toBeInTheDocument();
  });
});
