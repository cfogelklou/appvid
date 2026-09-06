import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from '../../src/components/BottomSheet';

const DialogHarness = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open settings</button>
      <BottomSheet title='Example settings' isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <button>Save settings</button>
      </BottomSheet>
    </>
  );
};

describe('BottomSheet', () => {
  it('manages dialog semantics, focus trapping, and focus restoration', () => {
    render(<DialogHarness />);

    const opener = screen.getByRole('button', { name: 'Open settings' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Example settings' });
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const saveButton = screen.getByRole('button', { name: 'Save settings' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(saveButton).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
