import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { STORE_PRESETS } from '../constants';
import { TopBar } from './TopBar';
import { EditorWorkspace } from './EditorWorkspace';
import { VideoImportCard } from './VideoImportCard';
import { VideoMetadataPanel } from './VideoMetadataPanel';
import { ExportSettingsSheet } from './ExportSettingsSheet';
import { ProcessingOverlay } from './ProcessingOverlay';
import { ExportCompletePanel } from './ExportCompletePanel';
import { processVideo, renderVideo, type ProcessLog } from '../utils/ffmpegEngine';
import { Clapperboard, HardDrive, MonitorPlay, Save, RotateCcw } from 'lucide-react';
import type { BatchItemStatus, LaidOutTextCue, LocaleCode } from '../text/types';
import { layoutCue, createCanvasMeasurer } from '../text/textLayout';
import {
  executeBatch,
  requestDirectoryHandle,
  loadBatchRecovery,
  clearBatchRecovery,
  persistBatchRecovery,
  type BatchRecoveryItem,
} from '../text/batchUtils';
import './components.css';

export const AppShell: React.FC = () => {
  const { project, hasDraft, restoreDraft, batchItems, setBatchItems, text, updateSettings } =
    useProject();

  // Dialog / overlay states
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Progress states
  const [exportStage, setExportStage] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState<ProcessLog[]>([]);

  // Batch processing states
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [, setBatchDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Cancellation support
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref to track current batch items (for use in callbacks where context setter lacks updater form)
  const batchItemsRef = useRef<typeof batchItems>(batchItems);
  useEffect(() => {
    batchItemsRef.current = batchItems;
  }, [batchItems]);

  // Load batch recovery on mount
  useEffect(() => {
    const recoveryItems = loadBatchRecovery();
    if (recoveryItems.length > 0) {
      const hasIncomplete = recoveryItems.some(
        (item) => item.status === 'failed' || item.status === 'cancelled',
      );
      if (hasIncomplete) {
        batchItemsRef.current = recoveryItems;
        setBatchItems(recoveryItems);
      }
    }
  }, [setBatchItems]);

  // Persist batch items on each change
  useEffect(() => {
    if (batchItems.length > 0) {
      persistBatchRecovery(batchItems as BatchRecoveryItem[]);
    }
  }, [batchItems]);

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
        controller.signal,
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
    setIsBatchProcessing(false);
  };

  const handleStartSingleTextExport = async (item: {
    locale: string;
    cueLayouts: LaidOutTextCue[];
  }) => {
    setIsExportSettingsOpen(false);
    setIsProcessing(true);
    setExportProgress(0);
    setExportStage('Initializing');
    setExportLogs([]);
    setExportBlob(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const output = await renderVideo(
        project,
        {
          locale: item.locale,
          textOverlays: item.cueLayouts,
          signal: controller.signal,
        },
        {
          onProgress: ({ stage, progress }) => {
            setExportStage(stage);
            setExportProgress(progress);
          },
          onLog: (log) => setExportLogs((previous) => [...previous, log]),
        },
      );
      setExportBlob(output);
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.message !== 'Export cancelled by user') {
        console.error('Text export failed:', error);
        alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleSwitchStoreAndExport = async (targetPresetId: string) => {
    const preset = STORE_PRESETS.find((p) => p.id === targetPresetId);
    if (!preset) return;

    setExportBlob(null);

    updateSettings({
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
    });

    const updatedProject = {
      ...project,
      settings: {
        ...project.settings,
        presetId: preset.id,
        width: preset.width,
        height: preset.height,
      },
    };

    const locale = text.previewLocale || 'en';
    const catalog = text.catalogs[locale];
    const frame = { width: preset.width, height: preset.height };
    const measure = createCanvasMeasurer();
    const cueLayouts = catalog
      ? text.cues.map((cue) => layoutCue({ cue, locale, catalog, frame, measure }))
      : [];

    setIsProcessing(true);
    setExportProgress(0);
    setExportStage(`Rendering for ${preset.name}...`);
    setExportLogs([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const output = await renderVideo(
        updatedProject,
        {
          locale,
          textOverlays: cueLayouts,
          signal: controller.signal,
        },
        {
          onProgress: ({ stage, progress }) => {
            setExportStage(stage);
            setExportProgress(progress);
          },
          onLog: (log) => setExportLogs((previous) => [...previous, log]),
        },
      );
      setExportBlob(output);
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.message !== 'Export cancelled by user') {
        console.error('Store switch export failed:', error);
        alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleStartBatchExport = async (batchInput: {
    items: Array<{ locale: string; cueLayouts: LaidOutTextCue[] }>;
  }) => {
    setIsExportSettingsOpen(false);
    setIsBatchProcessing(true);
    setExportProgress(0);
    setExportStage('Selecting output folder...');
    setExportLogs([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Request directory handle from user
      const handle = await requestDirectoryHandle();
      if (!handle) {
        // User cancelled the directory picker
        setIsBatchProcessing(false);
        return;
      }

      setBatchDirectoryHandle(handle);
      setExportStage('Starting batch export...');

      // Initialize batch items
      const initialItems = batchInput.items.map((item) => ({
        locale: item.locale,
        status: 'queued' as BatchItemStatus,
      }));
      batchItemsRef.current = initialItems;
      setBatchItems(initialItems);

      const output = await executeBatch({
        project,
        items: batchInput.items,
        signal: controller.signal,
        callbacks: {
          onProgress: (locale, status, message) => {
            console.log(`[Batch] ${locale}: ${status} - ${message || ''}`);
            const nextItems = batchItemsRef.current.map((i) =>
              i.locale === locale ? { locale, status, message } : i,
            );
            batchItemsRef.current = nextItems;
            setBatchItems(nextItems);

            // Update overall stage based on first active item
            if (status === 'rendering' || status === 'writing') {
              setExportStage(`Processing ${locale}...`);
            }
          },
          onLog: (log) => {
            console.log(`[Batch Log] ${log.message}`);
            setExportLogs((prev) => [...prev, log]);
          },
        },
        directoryHandle: handle,
      });

      console.log('Batch complete:', output);

      // Clear recovery on success
      if (output.failed.length === 0 && output.cancelled.length === 0) {
        clearBatchRecovery();
        setBatchItems([]);
      }
    } catch (e: any) {
      if (e.message !== 'Export cancelled by user') {
        console.error('Batch export failed:', e);
        alert(`Batch export failed: ${e.message || e}`);
      }
    } finally {
      setIsBatchProcessing(false);
      abortControllerRef.current = null;
      setBatchDirectoryHandle(null);
    }
  };

  const handleResumeBatchExport = async () => {
    const recoveryItems = loadBatchRecovery();
    if (recoveryItems.length === 0) {
      alert('No incomplete batch export found to resume.');
      return;
    }

    setIsBatchProcessing(true);
    setExportProgress(0);
    setExportStage('Resuming batch export...');
    setExportLogs([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Request directory handle again (not persistable)
      const handle = await requestDirectoryHandle();
      if (!handle) {
        setIsBatchProcessing(false);
        return;
      }

      setBatchDirectoryHandle(handle);

      // Filter to only retry failed/cancelled items
      const retryItems = recoveryItems.filter(
        (item) => item.status === 'failed' || item.status === 'cancelled',
      );

      if (retryItems.length === 0) {
        alert('All items in the batch are already completed.');
        setIsBatchProcessing(false);
        return;
      }

      console.log('Resuming batch with items:', retryItems);

      // Update batch items to queued for retry
      const queuedItems = retryItems.map((item) => ({
        ...item,
        status: 'queued' as BatchItemStatus,
        message: undefined,
      }));
      batchItemsRef.current = queuedItems;
      setBatchItems(queuedItems);

      const frame = {
        width: project.settings.width,
        height: project.settings.height,
      };
      const measure = createCanvasMeasurer();
      const items = retryItems.map(({ locale }) => {
        const catalog = text.catalogs[locale];
        if (!catalog) {
          throw new Error(
            `Cannot resume ${locale}: its translation catalog is no longer available.`,
          );
        }
        return {
          locale: locale as LocaleCode,
          cueLayouts: text.cues.map((cue) => layoutCue({ cue, locale, catalog, frame, measure })),
        };
      });

      const result = await executeBatch({
        project,
        items,
        signal: controller.signal,
        callbacks: {
          onProgress: (locale, status, message) => {
            const nextItems = batchItemsRef.current.map((item) =>
              item.locale === locale ? { locale, status, message } : item,
            );
            batchItemsRef.current = nextItems;
            setBatchItems(nextItems);
            if (status === 'rendering' || status === 'writing') {
              setExportStage(`Processing ${locale}...`);
            }
          },
          onLog: (log) => setExportLogs((previous) => [...previous, log]),
        },
        directoryHandle: handle,
      });

      console.log('Batch resume complete:', result);
      if (result.failed.length === 0 && result.cancelled.length === 0) {
        clearBatchRecovery();
        batchItemsRef.current = [];
        setBatchItems([]);
      }
    } catch (e: any) {
      if (e.message !== 'Export cancelled by user') {
        console.error('Batch resume failed:', e);
        alert(`Batch resume failed: ${e.message || e}`);
      }
    } finally {
      setIsBatchProcessing(false);
      abortControllerRef.current = null;
      setBatchDirectoryHandle(null);
    }
  };

  return (
    <div className='app-shell zinc-theme'>
      <TopBar onOpenExportSettings={handleStartExport} />

      <main className='app-content'>
        {!project.video ? (
          // Landing & Entry Screen
          <div className='landing-screen landing-desk'>
            <aside className='landing-rail' aria-label='AppVid workflow'>
              <p className='rail-label'>Local video production</p>
              <h1 className='landing-title'>AppVid</h1>
              <p className='rail-summary'>Store-preview videos, built entirely in your browser.</p>
              <ol className='workflow-list'>
                <li className='workflow-step workflow-step-active'>
                  <span>01</span>
                  <strong>Source recording</strong>
                </li>
                <li className='workflow-step'>
                  <span>02</span>
                  <strong>Arrange timeline</strong>
                </li>
                <li className='workflow-step'>
                  <span>03</span>
                  <strong>Export for store</strong>
                </li>
              </ol>
            </aside>
            <section className='landing-workbench' aria-labelledby='import-desk-title'>
              <header className='workbench-header'>
                <p className='section-index'>01 / Source</p>
                <h2 id='import-desk-title'>Bring in a screen recording.</h2>
                <p>
                  Start with the source video. You can add audio, text, and store framing in the
                  editor.
                </p>
              </header>
              <div className='landing-import-area'>
                {selectedFile ? (
                  <VideoMetadataPanel
                    file={selectedFile}
                    onCancel={() => setSelectedFile(null)}
                    onImportComplete={() => setSelectedFile(null)}
                  />
                ) : (
                  <VideoImportCard onFileSelected={(file) => setSelectedFile(file)} />
                )}
              </div>
              <div className='workbench-footer'>
                <HardDrive size={16} />
                <span>Your recording stays on this device. No account or upload is required.</span>
              </div>
            </section>

            <aside className='landing-reference' aria-label='Output and workflow notes'>
              <figure className='landing-product-figure'>
                <img
                  className='landing-product-image'
                  src='/appvid/images/appvid-feature.png'
                  alt='AppVid preview editor with a smartphone mockup and video timeline'
                />
                <figcaption>
                  <Clapperboard size={15} />
                  Preview, timecode, and export in one local workspace.
                </figcaption>
              </figure>
              <div className='reference-notes'>
                {hasDraft && (
                  <section className='restore-card'>
                    <div className='card-icon-header'>
                      <Save size={18} />
                      <h3>Restore Draft</h3>
                    </div>
                    <p>
                      You have a saved project draft in local storage. Click below to reload the
                      timeline.
                    </p>
                    <button className='btn btn-secondary btn-full' onClick={restoreDraft}>
                      Restore Last Session
                    </button>
                  </section>
                )}

                <section className='guidance-card'>
                  <div className='card-icon-header'>
                    <MonitorPlay size={18} />
                    <h3>Output notes</h3>
                  </div>
                  <ul className='guidance-list'>
                    <li>Supports portrait-mode MP4 or MOV screen recordings.</li>
                    <li>Designed to export exact aspect-ratios for App Store & Play Store.</li>
                    <li>Audio clips can be placed at specific playhead times.</li>
                    <li>High-quality offline exports can take a few minutes.</li>
                    <li>Keep the browser tab open during encoding.</li>
                  </ul>
                </section>
              </div>
            </aside>
          </div>
        ) : (
          <>
            {batchItems.some((item) => item.status === 'failed' || item.status === 'cancelled') && (
              <div className='batch-recovery-banner'>
                <span>An export was interrupted.</span>
                <button className='btn btn-secondary btn-sm' onClick={handleResumeBatchExport}>
                  <RotateCcw size={14} />
                  Resume Export
                </button>
              </div>
            )}
            <EditorWorkspace />
          </>
        )}
      </main>

      {/* Export Settings Dialog */}
      <ExportSettingsSheet
        isOpen={isExportSettingsOpen}
        onClose={() => setIsExportSettingsOpen(false)}
        onStartExport={handleTriggerTranscode}
        onStartBatchExport={handleStartBatchExport}
        onStartSingleTextExport={handleStartSingleTextExport}
      />

      {/* Processing Transcode Overlay */}
      <ProcessingOverlay
        isOpen={isProcessing || isBatchProcessing}
        stage={exportStage}
        progress={exportProgress}
        logs={exportLogs}
        onCancel={handleCancelExport}
      />

      {/* Export Complete Overlay */}
      {exportBlob && (
        <ExportCompletePanel
          outputBlob={exportBlob}
          onSingleClose={() => setExportBlob(null)}
          onSwitchStoreAndExport={handleSwitchStoreAndExport}
        />
      )}
    </div>
  );
};
export default AppShell;
