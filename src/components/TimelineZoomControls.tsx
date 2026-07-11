import React from 'react';
import { useProject } from '../context/ProjectContext';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import './TimelineZoomControls.css';

export const TimelineZoomControls: React.FC = () => {
  const { zoom, setZoom, project } = useProject();

  const handleZoomOut = () => {
    // Minimum zoom is 10 px/s
    setZoom(Math.max(10, zoom - 10));
  };

  const handleZoomIn = () => {
    // Maximum zoom is 250 px/s
    setZoom(Math.min(250, zoom + 10));
  };

  const handleZoomFit = () => {
    // Find viewport element to calculate zoom fit dynamically
    const viewport = document.querySelector('.timeline-viewport');
    const duration = project.video?.duration || 30; // default 30s if no video
    if (viewport) {
      const width = viewport.clientWidth;
      // Leave a 40px margin
      const fitZoom = Math.max(10, Math.min(250, (width - 40) / duration));
      setZoom(fitZoom);
    } else {
      setZoom(50);
    }
  };

  return (
    <div className='zoom-controls-container'>
      <button
        type='button'
        className='zoom-btn'
        onClick={handleZoomOut}
        title='Zoom Out (-10px/s)'
        disabled={zoom <= 10}
      >
        <ZoomOut size={16} />
      </button>
      <span className='zoom-percentage'>{zoom}px/s</span>
      <button
        type='button'
        className='zoom-btn'
        onClick={handleZoomIn}
        title='Zoom In (+10px/s)'
        disabled={zoom >= 250}
      >
        <ZoomIn size={16} />
      </button>
      <button
        type='button'
        className='zoom-btn zoom-fit-btn'
        onClick={handleZoomFit}
        title='Fit Timeline to Viewport'
      >
        <Maximize2 size={15} />
        <span>Fit</span>
      </button>
    </div>
  );
};
