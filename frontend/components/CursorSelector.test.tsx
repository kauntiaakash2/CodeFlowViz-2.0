import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CursorSelector from './CursorSelector';

describe('CursorSelector preference', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.cursor = '';
  });

  it('restores a saved cursor preference', async () => {
    window.localStorage.setItem('codeflowviz:cursor-style', 'Glow');

    render(<CursorSelector />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cursor style: Glow' })).toBeInTheDocument();
    });
    expect(document.body.style.cursor).toBe('pointer');
  });

  it('persists a newly selected cursor preference', () => {
    render(<CursorSelector />);

    fireEvent.click(screen.getByRole('button', { name: 'Cursor style: Default' }));
    fireEvent.click(screen.getByRole('option', { name: 'Trail' }));

    expect(window.localStorage.getItem('codeflowviz:cursor-style')).toBe('Trail');
    expect(screen.getByRole('button', { name: 'Cursor style: Trail' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('ignores an invalid saved preference', () => {
    window.localStorage.setItem('codeflowviz:cursor-style', 'Unknown');

    render(<CursorSelector />);

    expect(screen.getByRole('button', { name: 'Cursor style: Default' })).toBeInTheDocument();
  });

  it('closes the options with Escape', () => {
    render(<CursorSelector />);

    const trigger = screen.getByRole('button', { name: 'Cursor style: Default' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Cursor styles' }), {
      key: 'Escape',
    });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
