import React from 'react';
import { X } from 'lucide-react';
import './components.css';

interface BottomSheetProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ title, isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className='bottom-sheet-backdrop' onClick={onClose}>
      <div className='bottom-sheet-content' onClick={(e) => e.stopPropagation()}>
        <div className='bottom-sheet-header'>
          <h3 className='bottom-sheet-title'>{title}</h3>
          <button className='bottom-sheet-close-btn' onClick={onClose} aria-label='Close'>
            <X size={20} />
          </button>
        </div>
        <div className='bottom-sheet-body'>{children}</div>
      </div>
    </div>
  );
};
