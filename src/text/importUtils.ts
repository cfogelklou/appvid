/**
 * Import utilities for the multilingual text feature.
 * Agent A owns this file. Used by ProjectContext to drive text state.
 *
 * These functions orchestrate file reading, parsing, and state updates
 * using the pure functions from textPackage.ts.
 */

import type {
  CatalogBatchResult,
  LocaleCode,
  TextProjectState,
  TimelineImportResult,
} from './types';
import { parseCatalogBatch, parseTimeline, mergeCues } from './textPackage';
import { defaultPreviewLocale } from './localeValidation';

export interface CatalogFileInput {
  fileName: string;
  text: string;
}

/**
 * Read FileList/File[] and return UTF-8 text for each file.
 * Handles both FileList (from <input multiple>) and File[] (from drag-drop).
 */
export const readFilesAsText = async (
  files: FileList | File[],
  signal?: AbortSignal,
): Promise<CatalogFileInput[]> => {
  const fileArray = Array.from(files);
  const results = await Promise.all(
    fileArray.map(async (file) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const text = await file.text();
      return { fileName: file.name, text };
    }),
  );
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return results;
};

/**
 * Import multiple catalog files into text state.
 * Parses all files, merges accepted catalogs into state, sets preview locale.
 *
 * @param files - FileList or File[] of JSON catalog files
 * @param signal - Optional AbortSignal for cancellation
 * @returns CatalogBatchResult with accepted catalogs and summaries
 */
export const importTextCatalogs = async (
  currentState: TextProjectState,
  files: FileList | File[],
  signal?: AbortSignal,
): Promise<{ newState: TextProjectState; result: CatalogBatchResult }> => {
  // Read all files as text
  const fileInputs = await readFilesAsText(files, signal);

  // Parse the batch
  const batchResult = parseCatalogBatch(fileInputs);

  // Merge accepted catalogs into state
  const newCatalogs = { ...currentState.catalogs };
  for (const [locale, catalog] of Object.entries(batchResult.accepted)) {
    newCatalogs[locale] = catalog;
  }

  // Determine new preview locale
  const allLocales = Object.keys(newCatalogs) as LocaleCode[];
  const browserLocale = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const newPreviewLocale =
    currentState.previewLocale || defaultPreviewLocale(allLocales, browserLocale);

  const newState: TextProjectState = {
    ...currentState,
    catalogs: newCatalogs,
    previewLocale: newPreviewLocale,
  };

  return { newState, result: batchResult };
};

/**
 * Import a timeline.json file into text state.
 * Parses the file and merges cues into state using mergeCues.
 *
 * @param file - Single File object for timeline.json
 * @param signal - Optional AbortSignal for cancellation
 * @returns TimelineImportResult with parsed cues and any errors/warnings
 */
export const importTextTimeline = async (
  currentState: TextProjectState,
  file: File,
  signal?: AbortSignal,
): Promise<{ newState: TextProjectState; result: TimelineImportResult }> => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const text = await file.text();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const parseResult = parseTimeline(text);

  if (!parseResult.ok) {
    return { newState: currentState, result: parseResult };
  }

  // Merge imported cues with existing ones
  const mergeResult = mergeCues(currentState.cues, parseResult.cues);

  const newState: TextProjectState = {
    ...currentState,
    cues: mergeResult.cues,
  };

  return { newState, result: { ...parseResult, cues: mergeResult.cues } };
};
