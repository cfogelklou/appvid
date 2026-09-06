import React, { useId, useRef } from 'react';
import { X } from 'lucide-react';
import './components.css';
import { useDialogFocus } from './useDialogFocus';

interface BottomSheetProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ title, isOpen, onClose, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useDialogFocus({
    isOpen,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className='bottom-sheet-backdrop' onClick={onClose}>
      <div
        ref={dialogRef}
        className='bottom-sheet-content'
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='bottom-sheet-header'>
          <h3 id={titleId} className='bottom-sheet-title'>
            {title}
          </h3>
          <button
            ref={closeButtonRef}
            className='bottom-sheet-close-btn'
            onClick={onClose}
            aria-label='Close'
          >
            <X size={20} />
          </button>
        </div>
        <div className='bottom-sheet-body'>{children}</div>
      </div>
    </div>
  );
};
