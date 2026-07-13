/**
 * Batch orchestration and filesystem writes for multilingual text export.
 * Agent E (Wave 2) implementation.
 *
 * Handles sequential batch processing, wake locks, directory picks, and
 * collision-safe file writes. Exports metadata for recovery; never persists
 * directory handles.
 */

import type { Project } from '../types';
import type {
  BatchItemStatus,
  BatchRecoveryItem,
  LocaleCode,
  LaidOutTextCue,
} from './types';
import { buildExportFilename, resolveCollision } from './exportFilename';
import * as ffmpegEngine from '../utils/ffmpegEngine';

// Re-export types for convenience
export type { BatchRecoveryItem } from './types';

/**
 * Check if the browser supports directory picker API.
 */
export const supportsDirectoryPicker = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

/**
 * Request a directory handle from the user. Must be called from a user gesture.
 */
export const requestDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | undefined> => {
  if (!supportsDirectoryPicker()) {
    return undefined;
  }

  try {
    const handle = await (window as any).showDirectoryPicker();
    return handle;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // User cancelled the picker
      return undefined;
    }
    throw error;
  }
};

/**
 * Wake lock management to prevent screen sleep during batch processing.
 */
class WakeLockManager {
  private sentinel: any = null;

  async acquire(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.wakeLock) {
      return;
    }

    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch (error) {
      console.warn('Failed to acquire wake lock:', error);
    }
  }

  async release(): Promise<void> {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (error) {
        console.warn('Error releasing wake lock:', error);
      }
      this.sentinel = null;
    }
  }
}

/**
 * Input to the batch orchestration function.
 */
export interface BatchOrchestrationInput {
  project: Project;
  /** Locales to export (already validated for missing keys). */
  items: Array<{ locale: LocaleCode; cueLayouts: LaidOutTextCue[] }>;
  signal?: AbortSignal;
  callbacks: {
    onProgress: (locale: LocaleCode, status: BatchItemStatus, message?: string) => void;
    onLog: (log: { timestamp: number; message: string }) => void;
  };
  /** Folder handle from showDirectoryPicker (reselected on recovery). */
  directoryHandle?: FileSystemDirectoryHandle;
}

/**
 * Result of batch execution.
 */
export interface BatchResult {
  completed: LocaleCode[];
  failed: LocaleCode[];
  cancelled: LocaleCode[];
}

/**
 * Execute a batch export of multiple locales sequentially.
 *
 * Sequential processing guarantees:
 * - No FFmpeg contention (single-threaded WASM)
 * - Predictable memory usage
 * - Deterministic failure recovery
 *
 * Wake lock prevents sleep; cancellation preserves completed files.
 */
export async function executeBatch(
  input: BatchOrchestrationInput,
): Promise<BatchResult> {
  const { project, items, signal, callbacks, directoryHandle } = input;
  const wakeLock = new WakeLockManager();
  const existingFilenames = new Set<string>();

  // Track results
  const completed: LocaleCode[] = [];
  const failed: LocaleCode[] = [];
  const cancelled: LocaleCode[] = [];

  // Helper to log
  const log = (message: string) => {
    callbacks.onLog({ timestamp: Date.now(), message });
  };

  // Helper to check for abort
  const checkAbort = () => {
    if (signal?.aborted) {
      throw new Error('Batch cancelled by user');
    }
  };

  try {
    await wakeLock.acquire();
    log('Starting batch export');

    // Get the renderVideo function (Agent D's implementation).
    // Static import — ffmpegEngine is already in the main bundle via AppShell.
    const renderVideoFn = (ffmpegEngine as any).renderVideo || ffmpegEngine.processVideo;

    if (!renderVideoFn) {
      throw new Error('renderVideo function not available.');
    }

    // Process locales sequentially
    for (const item of items) {
      checkAbort();

      const { locale, cueLayouts } = item;
      log(`Processing locale: ${locale}`);

      try {
        // Set status to rendering
        callbacks.onProgress(locale, 'rendering', `Rendering ${locale}...`);

        // Call renderVideo with locale and text overlays
        // Signature: renderVideo(project, { locale, textOverlays, signal }, { onProgress, onLog })
        const blob = await renderVideoFn(
          project,
          {
            locale,
            textOverlays: cueLayouts,
            signal
          },
          {
            onProgress: (data: { stage: string; progress: number }) => {
              log(`[${locale}] ${data.stage}: ${(data.progress * 100).toFixed(0)}%`);
            },
            onLog: (logEntry: { timestamp: number; message: string }) => {
              log(`[${locale}] ${logEntry.message}`);
            },
          },
        );

        // Rendering successful - now write file
        checkAbort();
        callbacks.onProgress(locale, 'writing', `Writing ${locale}...`);

        if (!directoryHandle) {
          throw new Error('No directory handle available for writing');
        }

        // Generate filename and resolve collisions
        const baseFilename = buildExportFilename({
          projectName: project.name,
          presetName: project.settings.presetId,
          locale,
        });

        const filename = resolveCollision(baseFilename, existingFilenames);
        existingFilenames.add(filename);

        // Write file to directory
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob as Blob);
        await writable.close();

        // Success!
        completed.push(locale);
        callbacks.onProgress(locale, 'completed', `Completed ${locale}`);
        log(`✓ Completed export: ${filename}`);

      } catch (error: any) {
        checkAbort(); // Re-throw if this was an abort

        // Failure for this locale - continue to next
        failed.push(locale);
        const errorMessage = error?.message || 'Unknown error';
        callbacks.onProgress(locale, 'failed', errorMessage);
        log(`✗ Failed ${locale}: ${errorMessage}`);
      }
    }

    log(`Batch complete: ${completed.length} succeeded, ${failed.length} failed`);

    return { completed, failed, cancelled };

  } catch (error: any) {
    // Handle abort - mark remaining as cancelled
    if (error.message === 'Batch cancelled by user' || signal?.aborted) {
      const remaining = items.filter(
        item => !completed.includes(item.locale) && !failed.includes(item.locale)
      );

      for (const item of remaining) {
        callbacks.onProgress(item.locale, 'cancelled', 'Cancelled by user');
      }

      cancelled.push(...remaining.map(item => item.locale));
      log(`Batch cancelled: ${cancelled.length} items cancelled`);

      return { completed, failed, cancelled };
    }

    // Unexpected error - fail all remaining
    const remaining = items.filter(
      item => !completed.includes(item.locale) && !failed.includes(item.locale)
    );

    for (const item of remaining) {
      callbacks.onProgress(item.locale, 'failed', error.message || 'Batch failed');
      failed.push(item.locale);
    }

    throw error;

  } finally {
    await wakeLock.release();
  }
}

/**
 * Convert batch items to recovery items for persistence.
 * Only serializable metadata (no directory handles).
 */
export const toRecoveryItems = (
  items: Array<{ locale: LocaleCode; status: BatchItemStatus; message?: string }>
): BatchRecoveryItem[] => {
  return items.map(item => ({
    locale: item.locale,
    status: item.status,
    message: item.message,
  }));
};

/**
 * Build initial batch recovery items for a new export.
 */
export const buildInitialRecoveryItems = (
  locales: LocaleCode[]
): BatchRecoveryItem[] => {
  return locales.map(locale => ({
    locale,
    status: 'queued' as BatchItemStatus,
  }));
};

/**
 * Filter batch items to those that need retry (failed or cancelled).
 */
export const getRetryItems = (
  items: BatchRecoveryItem[]
): BatchRecoveryItem[] => {
  return items.filter(
    item => item.status === 'failed' || item.status === 'cancelled'
  ).map(item => ({
    ...item,
    status: 'queued' as BatchItemStatus,
    message: undefined,
  }));
};

/**
 * Local storage key for batch recovery metadata.
 */
export const BATCH_RECOVERY_KEY = 'appvid_batch_recovery';

/**
 * Persist batch recovery items to localStorage.
 */
export const persistBatchRecovery = (items: BatchRecoveryItem[]): void => {
  try {
    localStorage.setItem(BATCH_RECOVERY_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to persist batch recovery:', error);
  }
};

/**
 * Load batch recovery items from localStorage.
 */
export const loadBatchRecovery = (): BatchRecoveryItem[] => {
  try {
    const data = localStorage.getItem(BATCH_RECOVERY_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data);
    // Validate basic structure
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load batch recovery:', error);
  }
  return [];
};

/**
 * Clear batch recovery from localStorage.
 */
export const clearBatchRecovery = (): void => {
  try {
    localStorage.removeItem(BATCH_RECOVERY_KEY);
  } catch (error) {
    console.warn('Failed to clear batch recovery:', error);
  }
};
