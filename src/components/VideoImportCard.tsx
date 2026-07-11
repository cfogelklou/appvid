import React, { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import './components.css';

interface VideoImportCardProps {
  onFileSelected: (file: File) => void;
}

export const VideoImportCard: React.FC<VideoImportCardProps> = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onFileSelected(file);
      } else {
        alert('Invalid file format. Please import a video file.');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file);
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className='import-card-container'>
      <div
        className={`import-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
      >
        <input
          type='file'
          ref={fileInputRef}
          onChange={handleFileChange}
          accept='video/*'
          style={{ display: 'none' }}
        />

        <div className='import-icon-container'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='28'
            height='28'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
            <polyline points='17 8 12 3 7 8' />
            <line x1='12' y1='3' x2='12' y2='15' />
          </svg>
        </div>

        <h3 className='import-title'>Import Screen Recording</h3>
        <p className='import-subtitle'>
          Drag & drop your screen recording here, or click to browse files.
        </p>
        <button className='import-btn' type='button'>
          Choose File
        </button>
      </div>

      <div className='privacy-note'>
        <div className='privacy-icon'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
            <path d='M7 11V7a5 5 0 0 1 10 0v4' />
          </svg>
        </div>
        <p className='privacy-text'>
          <strong>100% Local Privacy:</strong> All video processing is performed inside your web
          browser. Your screen recordings are never uploaded or sent to any server.
        </p>
      </div>
    </div>
  );
};
