import React, { useState, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { TopBar } from './TopBar';
import { EditorWorkspace } from './EditorWorkspace';
import { VideoImportCard } from './VideoImportCard';
import { VideoMetadataPanel } from './VideoMetadataPanel';
import { StorePresetSelector } from './StorePresetSelector';
import { ExportSettingsSheet } from './ExportSettingsSheet';
import { ProcessingOverlay } from './ProcessingOverlay';
import { ExportCompletePanel } from './ExportCompletePanel';
import { processVideo, type ProcessLog } from '../utils/ffmpegEngine';
import { Sparkles, Shield, MonitorPlay, Save } from 'lucide-react';
import { AdBanner } from './AdBanner';
import './components.css';

export const AppShell: React.FC = () => {
  const { project, hasDraft, restoreDraft } = useProject();
  
  // Dialog / overlay states
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Progress states
  const [exportStage, setExportStage] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState<ProcessLog[]>([]);
  
  // Cancellation support
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartExport = () => {
    setIsExportSettingsOpen(true);
  };

  const handleTriggerTranscode = async () => {
    setIsExportSettingsOpen(false);
    setIsProcessing(true);
    setExportProgress(0);
    setExportStage('Initializing');
    setExportLogs([]);
    setExportBlob(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const output = await processVideo(
        project,
        ({ stage, progress }) => {
          console.log(`[Export Progress] ${stage}: ${(progress * 100).toFixed(0)}%`);
          setExportStage(stage);
          setExportProgress(progress);
        },
        (log) => {
          console.log(`[FFmpeg Log] ${log.message}`);
          setExportLogs((prev) => [...prev, log]);
        },
        controller.signal
      );
      
      setExportBlob(output);
    } catch (e: any) {
      if (e.message !== 'Export cancelled by user') {
        console.error('Export failed:', e);
        alert(`Export failed: ${e.message || e}`);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
  };

  return (
    <div className="app-shell zinc-theme">
      <TopBar onOpenExportSettings={handleStartExport} />

      <main className="app-content">
        {!project.video ? (
          // Landing & Entry Screen
          <div className="landing-screen">
            <div className="landing-hero">
              <div className="hero-badge">
                <Sparkles size={14} />
                <span>100% Local Browser Engine</span>
              </div>
              <h1 className="landing-title">AppVid</h1>
              <p className="landing-tagline">Create app preview videos locally.</p>
              <p className="landing-trust-note">
                <Shield size={14} />
                <span>No uploads. No accounts. Your files never leave your browser.</span>
              </p>
            </div>

            <div className="landing-grid">
              <div className="landing-main-card">
                {selectedFile ? (
                  <VideoMetadataPanel
                    file={selectedFile}
                    onCancel={() => setSelectedFile(null)}
                    onImportComplete={() => setSelectedFile(null)}
                  />
                ) : (
                  <>
                    <h2 className="card-section-title">1. Choose Output Layout Preset</h2>
                    <StorePresetSelector />
                    
                    <h2 className="card-section-title" style={{ marginTop: '24px' }}>2. Import Screen Recording</h2>
                    <VideoImportCard onFileSelected={(file) => setSelectedFile(file)} />
                  </>
                )}
              </div>

              <div className="landing-side-cards">
                {hasDraft && (
                  <div className="landing-side-card restore-card">
                    <div className="card-icon-header">
                      <Save size={18} />
                      <h3>Restore Draft</h3>
                    </div>
                    <p>You have a saved project draft in local storage. Click below to reload the timeline.</p>
                    <button className="btn btn-secondary btn-full" onClick={restoreDraft}>
                      Restore Last Session
                    </button>
                  </div>
                )}

                <div className="landing-side-card guidance-card">
                  <div className="card-icon-header">
                    <MonitorPlay size={18} />
                    <h3>Getting Started</h3>
                  </div>
                  <ul className="guidance-list">
                    <li>Supports portrait-mode MP4 or MOV screen recordings.</li>
                    <li>Designed to export exact aspect-ratios for App Store & Play Store.</li>
                    <li>Audio clips can be placed at specific playhead times.</li>
                    <li>High-quality offline exports can take a few minutes.</li>
                    <li>Keep the browser tab open during encoding.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Editor Workspace
          <EditorWorkspace />
        )}
      </main>

      {/* Export Settings Dialog */}
      <ExportSettingsSheet
        isOpen={isExportSettingsOpen}
        onClose={() => setIsExportSettingsOpen(false)}
        onStartExport={handleTriggerTranscode}
      />

      {/* Processing Transcode Overlay */}
      <ProcessingOverlay
        isOpen={isProcessing}
        stage={exportStage}
        progress={exportProgress}
        logs={exportLogs}
        onCancel={handleCancelExport}
      />

      {/* Export Complete Overlay */}
      {exportBlob && (
        <ExportCompletePanel
          outputBlob={exportBlob}
          onClose={() => setExportBlob(null)}
        />
      )}

      {/* Manual AdSense Banner */}
      <div className="ad-banner-wrapper">
        <AdBanner orientation="portrait" height={90} width={1200} />
      </div>
    </div>
  );
};
export default AppShell;
