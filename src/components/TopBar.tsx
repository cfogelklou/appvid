import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Video, Save, Download } from 'lucide-react';
import './components.css';

interface TopBarProps {
  onOpenExportSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenExportSettings }) => {
  const { project, activePreset, saveDraft, hasDraft, restoreDraft } = useProject();

  return (
    <header className='top-bar'>
      <div className='top-bar-left'>
        <div className='app-logo'>
          <Video className='logo-icon' size={20} />
          <span className='app-title'>AppVid</span>
        </div>
        <div className='project-info'>
          <span className='project-name'>{project.name}</span>
          <span className='preset-badge'>{activePreset.name}</span>
        </div>
      </div>

      <div className='top-bar-actions'>
        {hasDraft && !project.video && (
          <button
            className='btn btn-secondary btn-sm'
            onClick={restoreDraft}
            title='Restore last draft'
          >
            <Save size={16} />
            <span>Restore Draft</span>
          </button>
        )}
        <button
          className='btn btn-secondary btn-sm'
          onClick={saveDraft}
          title='Save project draft metadata'
        >
          <Save size={16} />
          <span>Save Draft</span>
        </button>
        {project.video && (
          <button className='btn btn-primary btn-sm' onClick={onOpenExportSettings}>
            <Download size={16} />
            <span>Export</span>
          </button>
        )}
      </div>
    </header>
  );
};
