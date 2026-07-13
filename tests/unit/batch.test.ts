/**
 * Unit tests for batch orchestration utilities (Agent E).
 *
 * Tests sequential processing, wake locks, collision handling, and
 * recovery persistence.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  supportsDirectoryPicker,
  requestDirectoryHandle,
  executeBatch,
  toRecoveryItems,
  buildInitialRecoveryItems,
  getRetryItems,
  persistBatchRecovery,
  loadBatchRecovery,
  clearBatchRecovery,
  BATCH_RECOVERY_KEY,
} from '../../src/text/batchUtils';
import type { BatchItemStatus, BatchRecoveryItem } from '../../src/text/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Mock window.showDirectoryPicker
const mockDirectoryPicker = vi.fn();

// Mock navigator.wakeLock
const mockWakeLock = {
  request: vi.fn().mockResolvedValue({
    release: vi.fn().mockResolvedValue(undefined),
  }),
};

// Setup global mocks
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', {
  value: {
    showDirectoryPicker: mockDirectoryPicker,
  },
  writable: true,
});
Object.defineProperty(global, 'navigator', {
  value: {
    wakeLock: mockWakeLock,
  },
  writable: true,
});

// Mock renderVideo function
vi.mock('../../src/utils/ffmpegEngine', () => ({
  renderVideo: vi.fn().mockResolvedValue(new Blob(['video data'], { type: 'video/mp4' })),
  processVideo: vi.fn().mockResolvedValue(new Blob(['video data'], { type: 'video/mp4' })),
}));

describe('Batch Utils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearBatchRecovery();
  });

  describe('supportsDirectoryPicker', () => {
    it('should return true when showDirectoryPicker is available', () => {
      expect(supportsDirectoryPicker()).toBe(true);
    });

    it('should return false when showDirectoryPicker is not available', () => {
      // @ts-ignore - testing missing API
      delete window.showDirectoryPicker;
      expect(supportsDirectoryPicker()).toBe(false);
      // Restore for other tests
      window.showDirectoryPicker = mockDirectoryPicker;
    });
  });

  describe('requestDirectoryHandle', () => {
    it('should request directory handle from user', async () => {
      const mockHandle = { kind: 'directory', name: 'export' };
      mockDirectoryPicker.mockResolvedValue(mockHandle);

      const handle = await requestDirectoryHandle();
      expect(handle).toEqual(mockHandle);
      expect(mockDirectoryPicker).toHaveBeenCalledTimes(1);
    });

    it('should return undefined on user abort', async () => {
      const abortError = new Error('User aborted');
      abortError.name = 'AbortError';
      mockDirectoryPicker.mockRejectedValue(abortError);

      const handle = await requestDirectoryHandle();
      expect(handle).toBeUndefined();
    });

    it('should throw on other errors', async () => {
      mockDirectoryPicker.mockRejectedValue(new Error('Permission denied'));

      await expect(requestDirectoryHandle()).rejects.toThrow('Permission denied');
    });
  });

  describe('Recovery item utilities', () => {
    it('should convert batch items to recovery items', () => {
      const items = [
        { locale: 'en', status: 'completed' as BatchItemStatus },
        { locale: 'sv', status: 'failed' as BatchItemStatus, message: 'Missing key' },
        { locale: 'ja', status: 'queued' as BatchItemStatus },
      ];

      const recovery = toRecoveryItems(items);
      expect(recovery).toEqual(items);
    });

    it('should build initial recovery items', () => {
      const locales = ['en', 'sv', 'ja'];
      const items = buildInitialRecoveryItems(locales);

      expect(items).toHaveLength(3);
      expect(items.every(item => item.status === 'queued')).toBe(true);
      expect(items.map(item => item.locale)).toEqual(locales);
    });

    it('should filter retry items (failed and cancelled)', () => {
      const items: BatchRecoveryItem[] = [
        { locale: 'en', status: 'completed' },
        { locale: 'sv', status: 'failed', message: 'Error' },
        { locale: 'ja', status: 'cancelled' },
        { locale: 'de', status: 'queued' },
      ];

      const retry = getRetryItems(items);
      expect(retry).toHaveLength(2);
      expect(retry.every(item => item.status === 'queued')).toBe(true);
      expect(retry.map(item => item.locale)).toEqual(['sv', 'ja']);
    });
  });

  describe('Recovery persistence', () => {
    it('should persist and load batch recovery items', () => {
      const items: BatchRecoveryItem[] = [
        { locale: 'en', status: 'completed' },
        { locale: 'sv', status: 'failed', message: 'Error' },
      ];

      persistBatchRecovery(items);
      const loaded = loadBatchRecovery();

      expect(loaded).toEqual(items);
    });

    it('should return empty array when no recovery data exists', () => {
      const loaded = loadBatchRecovery();
      expect(loaded).toEqual([]);
    });

    it('should clear batch recovery', () => {
      const items: BatchRecoveryItem[] = [
        { locale: 'en', status: 'completed' },
      ];

      persistBatchRecovery(items);
      clearBatchRecovery();

      const loaded = loadBatchRecovery();
      expect(loaded).toEqual([]);
    });

    it('should handle corrupted recovery data gracefully', () => {
      localStorage.setItem(BATCH_RECOVERY_KEY, 'invalid json');
      const loaded = loadBatchRecovery();
      expect(loaded).toEqual([]);
    });

    it('should handle non-array recovery data gracefully', () => {
      localStorage.setItem(BATCH_RECOVERY_KEY, JSON.stringify({ not: 'an array' }));
      const loaded = loadBatchRecovery();
      expect(loaded).toEqual([]);
    });
  });

  describe('executeBatch', () => {
    it('should process a single locale successfully', async () => {
      const mockHandle = {
        kind: 'directory',
        name: 'export',
        getFileHandle: vi.fn().mockResolvedValue({
          createWritable: vi.fn().mockResolvedValue({
            write: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      mockDirectoryPicker.mockResolvedValue(mockHandle);

      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        video: null,
        audioAssets: [],
        segments: [],
        settings: {
          presetId: 'ios-iphone-15-pro',
          width: 1170,
          height: 2532,
          fitMode: 'fit',
          originalAudioMode: 'keep',
          quality: 'high',
        },
        updatedAt: Date.now(),
      };

      const onProgress = vi.fn();
      const onLog = vi.fn();

      const result = await executeBatch({
        project: mockProject,
        items: [
          { locale: 'en', cueLayouts: [] },
        ],
        callbacks: { onProgress, onLog },
        directoryHandle: mockHandle as any,
      });

      expect(result.completed).toEqual(['en']);
      expect(result.failed).toEqual([]);
      expect(result.cancelled).toEqual([]);
    });

    it('should handle abort signal', async () => {
      const mockHandle = {
        kind: 'directory',
        name: 'export',
        getFileHandle: vi.fn().mockResolvedValue({
          createWritable: vi.fn().mockResolvedValue({
            write: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      mockDirectoryPicker.mockResolvedValue(mockHandle);

      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        video: null,
        audioAssets: [],
        segments: [],
        settings: {
          presetId: 'ios-iphone-15-pro',
          width: 1170,
          height: 2532,
          fitMode: 'fit',
          originalAudioMode: 'keep',
          quality: 'high',
        },
        updatedAt: Date.now(),
      };

      const controller = new AbortController();
      const onProgress = vi.fn();
      const onLog = vi.fn();

      // Abort immediately
      controller.abort();

      const result = await executeBatch({
        project: mockProject,
        items: [
          { locale: 'en', cueLayouts: [] },
          { locale: 'sv', cueLayouts: [] },
        ],
        signal: controller.signal,
        callbacks: { onProgress, onLog },
        directoryHandle: mockHandle as any,
      });

      expect(result.cancelled).toHaveLength(2);
      expect(result.completed).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('should handle per-locale failures', async () => {
      const mockHandle = {
        kind: 'directory',
        name: 'export',
        getFileHandle: vi.fn()
          .mockResolvedValueOnce({
            createWritable: vi.fn().mockResolvedValue({
              write: vi.fn().mockResolvedValue(undefined),
              close: vi.fn().mockResolvedValue(undefined),
            }),
          })
          .mockRejectedValueOnce(new Error('Write failed')),
      };

      mockDirectoryPicker.mockResolvedValue(mockHandle);

      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        video: null,
        audioAssets: [],
        segments: [],
        settings: {
          presetId: 'ios-iphone-15-pro',
          width: 1170,
          height: 2532,
          fitMode: 'fit',
          originalAudioMode: 'keep',
          quality: 'high',
        },
        updatedAt: Date.now(),
      };

      const onProgress = vi.fn();
      const onLog = vi.fn();

      const result = await executeBatch({
        project: mockProject,
        items: [
          { locale: 'en', cueLayouts: [] },
          { locale: 'sv', cueLayouts: [] },
        ],
        callbacks: { onProgress, onLog },
        directoryHandle: mockHandle as any,
      });

      expect(result.completed).toEqual(['en']);
      expect(result.failed).toEqual(['sv']);
      expect(result.cancelled).toEqual([]);
    });
  });
});
