import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { VideoPreview } from './VideoPreview';
import { PlaybackControls } from './PlaybackControls';
import { Timeline } from './Timeline';
import { TimelineZoomControls } from './TimelineZoomControls';
import { AssetPanel } from './AssetPanel';
import { ClipInspector } from './ClipInspector';
import { StoreReadinessPanel } from './StoreReadinessPanel';
import { Music, Eye, ClipboardCheck } from 'lucide-react';
import './components.css';

export const EditorWorkspace: React.FC = () => {
  const { project, selectedSegmentId } = useProject();
  const [activeTab, setActiveTab] = useState<'assets' | 'inspector' | 'readiness'>('assets');

  // Auto-switch to inspector when a segment is selected
  React.useEffect(() => {
    if (selectedSegmentId) {
      setActiveTab('inspector');
    }
  }, [selectedSegmentId]);

  if (!project.video) {
    return null;
  }

  return (
    <div className="editor-workspace">
      <div className="workspace-upper">
        {/* Main Video & Controls Section */}
        <div className="preview-section">
          <div className="preview-container-wrapper">
            <VideoPreview />
          </div>
          <PlaybackControls />
        </div>

        {/* Desktop Sidebar / Mobile Tabs Panel */}
        <aside className="sidebar-section">
          <div className="sidebar-tabs" role="tablist" aria-label="Sidebar Navigation Panels">
            <button
              role="tab"
              aria-selected={activeTab === 'assets'}
              aria-controls="sidebar-panel-content"
              className={`sidebar-tab ${activeTab === 'assets' ? 'active' : ''}`}
              onClick={() => setActiveTab('assets')}
            >
              <Music size={16} />
              <span>Assets</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'inspector'}
              aria-controls="sidebar-panel-content"
              className={`sidebar-tab ${activeTab === 'inspector' ? 'active' : ''}`}
              onClick={() => setActiveTab('inspector')}
              disabled={!selectedSegmentId}
              title={!selectedSegmentId ? 'Select an audio segment to inspect' : ''}
            >
              <Eye size={16} />
              <span>Inspector</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'readiness'}
              aria-controls="sidebar-panel-content"
              className={`sidebar-tab ${activeTab === 'readiness' ? 'active' : ''}`}
              onClick={() => setActiveTab('readiness')}
            >
              <ClipboardCheck size={16} />
              <span>Store Readiness</span>
            </button>
          </div>

          <div className="sidebar-content" id="sidebar-panel-content" role="tabpanel">
            {activeTab === 'assets' && <AssetPanel />}
            {activeTab === 'inspector' && <ClipInspector />}
            {activeTab === 'readiness' && <StoreReadinessPanel />}
          </div>
        </aside>
      </div>

      {/* Timeline Section */}
      <div className="workspace-lower">
        <div className="timeline-header-row">
          <span className="section-label">Timeline Editor</span>
          <TimelineZoomControls />
        </div>
        <div className="timeline-container-wrapper">
          <Timeline />
        </div>
      </div>
    </div>
  );
};
export default EditorWorkspace;
