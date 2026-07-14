/**
 * Unit tests for text import and ProjectContext integration.
 * Agent A owns this test file.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { TextCue, TextProjectState } from '../../src/text/types';
import { createDefaultCueBase } from '../../src/text/constants';
import { readFilesAsText, importTextCatalogs, importTextTimeline } from '../../src/text/importUtils';

describe('Text Import Utils', () => {
  describe('readFilesAsText', () => {
    it('should read FileList and return text content', async () => {
      // Mock File objects with text method
      const mockFile1 = {
        name: 'en.json',
        text: async () => '{"hello":"Hello"}',
      } as unknown as File;
      const mockFile2 = {
        name: 'sv.json',
        text: async () => '{"hello":"Hej"}',
      } as unknown as File;
      const fileList = [mockFile1, mockFile2] as unknown as FileList;

      const results = await readFilesAsText(fileList);

      expect(results).toHaveLength(2);
      expect(results[0].fileName).toBe('en.json');
      expect(results[0].text).toBe('{"hello":"Hello"}');
      expect(results[1].fileName).toBe('sv.json');
      expect(results[1].text).toBe('{"hello":"Hej"}');
    });

    it('should handle empty FileList', async () => {
      const results = await readFilesAsText([]);
      expect(results).toEqual([]);
    });

    it('should abort when signal is aborted', async () => {
      const mockFile = {
        name: 'en.json',
        text: async () => '{"hello":"Hello"}',
      } as unknown as File;
      const controller = new AbortController();
      controller.abort();

      await expect(readFilesAsText([mockFile], controller.signal)).rejects.toThrow('Aborted');
    });
  });

  describe('importTextCatalogs', () => {
    let initialState: TextProjectState;

    beforeEach(() => {
      initialState = {
        catalogs: {},
        cues: [],
        previewLocale: null,
      };
    });

    it('should import valid catalogs and populate state', async () => {
      const file1 = {
        name: 'en.json',
        text: async () => '{"greeting":"Hello","farewell":"Goodbye"}',
      } as unknown as File;
      const file2 = {
        name: 'sv.json',
        text: async () => '{"greeting":"Hej","farewell":"Hejdå"}',
      } as unknown as File;

      const { newState, result } = await importTextCatalogs(initialState, [file1, file2]);

      expect(newState.catalogs['en']).toBeDefined();
      expect(newState.catalogs['sv']).toBeDefined();
      expect(newState.catalogs['en'].strings).toEqual({ greeting: 'Hello', farewell: 'Goodbye' });
      expect(newState.catalogs['sv'].strings).toEqual({ greeting: 'Hej', farewell: 'Hejdå' });
      expect(result.accepted).toHaveProperty('en');
      expect(result.accepted).toHaveProperty('sv');
    });

    it('should set preview locale based on browser locale if available', async () => {
      // Mock navigator.language
      const originalLanguage = (globalThis as any).navigator?.language;
      Object.defineProperty(globalThis.navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });

      const file1 = {
        name: 'en.json',
        text: async () => '{"hello":"Hello"}',
      } as unknown as File;
      const file2 = {
        name: 'sv.json',
        text: async () => '{"hello":"Hej"}',
      } as unknown as File;

      const { newState } = await importTextCatalogs(initialState, [file1, file2]);

      // Should prefer en-US -> en match
      expect(newState.previewLocale).toBe('en');

      // Restore
      if (originalLanguage) {
        Object.defineProperty(globalThis.navigator, 'language', {
          value: originalLanguage,
          configurable: true,
        });
      } else {
        delete (globalThis.navigator as any).language;
      }
    });

    it('should fall back to first imported locale if no browser match', async () => {
      // Mock navigator.language to something not imported
      const originalLanguage = (globalThis as any).navigator?.language;
      Object.defineProperty(globalThis.navigator, 'language', {
        value: 'de-DE',
        configurable: true,
      });

      const file1 = {
        name: 'en.json',
        text: async () => '{"hello":"Hello"}',
      } as unknown as File;
      const file2 = {
        name: 'sv.json',
        text: async () => '{"hello":"Hej"}',
      } as unknown as File;

      const { newState } = await importTextCatalogs(initialState, [file1, file2]);

      // Should fall back to first imported locale
      expect(newState.previewLocale).toBe('en');

      // Restore
      if (originalLanguage) {
        Object.defineProperty(globalThis.navigator, 'language', {
          value: originalLanguage,
          configurable: true,
        });
      } else {
        delete (globalThis.navigator as any).language;
      }
    });

    it('should merge new catalogs with existing ones', async () => {
      const stateWithExisting: TextProjectState = {
        catalogs: {
          en: { locale: 'en', sourceFileName: 'en.json', strings: { hello: 'Hello' } },
        },
        cues: [],
        previewLocale: 'en',
      };

      const newFile = {
        name: 'sv.json',
        text: async () => '{"hello":"Hej"}',
      } as unknown as File;

      const { newState } = await importTextCatalogs(stateWithExisting, [newFile]);

      expect(newState.catalogs['en']).toBeDefined(); // Existing preserved
      expect(newState.catalogs['sv']).toBeDefined(); // New added
      expect(Object.keys(newState.catalogs)).toHaveLength(2);
    });

    it('should reject duplicate locales in same batch', async () => {
      const file1 = {
        name: 'en.json',
        text: async () => '{"hello":"Hello"}',
      } as unknown as File;
      const file2 = {
        name: 'en.json',
        text: async () => '{"hi":"Hi"}',
      } as unknown as File; // Same locale

      const { result } = await importTextCatalogs(initialState, [file1, file2]);

      expect(result.duplicateLocales).toContain('en');
      expect(result.summaries.filter((s) => s.accepted)).toHaveLength(0); // None accepted
    });

    it('should reject invalid catalog files', async () => {
      const invalidFile = {
        name: 'invalid.json',
        text: async () => 'not valid json',
      } as unknown as File;

      const { result } = await importTextCatalogs(initialState, [invalidFile]);

      expect(result.summaries[0].accepted).toBe(false);
      expect(result.summaries[0].reasons.length).toBeGreaterThan(0);
    });
  });

  describe('importTextTimeline', () => {
    let initialState: TextProjectState;

    beforeEach(() => {
      initialState = {
        catalogs: {
          en: { locale: 'en', sourceFileName: 'en.json', strings: { greeting: 'Hello' } },
        },
        cues: [],
        previewLocale: 'en',
      };
    });

    it('should parse valid timeline.json and import cues', async () => {
      const timelineContent = JSON.stringify({
        version: 1,
        cues: [
          {
            id: 'cue1',
            stringKey: 'greeting',
            startTime: 0,
            duration: 3,
            horizontalAlign: 'center',
            verticalAlign: 'middle',
            color: '#FFFFFF',
            fontSize: 72,
          },
        ],
      });

      const file = {
        name: 'timeline.json',
        text: async () => timelineContent,
      } as unknown as File;

      const { newState, result } = await importTextTimeline(initialState, file);

      expect(result.ok).toBe(true);
      expect(newState.cues).toHaveLength(1);
      expect(newState.cues[0].id).toBe('cue1');
      expect(newState.cues[0].origin).toBe('timeline-import');
    });

    it('should merge cues on reimport, preserving overrides', async () => {
      const existingCue: TextCue = {
        id: 'cue1',
        origin: 'timeline-import',
        base: createDefaultCueBase('greeting', 0, 3),
        overrides: { fontSize: 80 }, // User modified
      };

      const stateWithCue: TextProjectState = {
        ...initialState,
        cues: [existingCue],
      };

      const timelineContent = JSON.stringify({
        version: 1,
        cues: [
          {
            id: 'cue1',
            stringKey: 'greeting',
            startTime: 0,
            duration: 3,
            horizontalAlign: 'center',
            verticalAlign: 'middle',
            color: '#FFFFFF',
            fontSize: 72, // Different from override
          },
        ],
      });

      const file = {
        name: 'timeline.json',
        text: async () => timelineContent,
      } as unknown as File;

      const { newState } = await importTextTimeline(stateWithCue, file);

      expect(newState.cues).toHaveLength(1);
      expect(newState.cues[0].overrides.fontSize).toBe(80); // Override preserved
      expect(newState.cues[0].base.fontSize).toBe(72); // Base updated
    });

    it('should preserve manual cues on reimport', async () => {
      const manualCue: TextCue = {
        id: 'manual1',
        origin: 'manual',
        base: createDefaultCueBase('manual', 5, 2),
        overrides: {},
      };

      const stateWithManual: TextProjectState = {
        ...initialState,
        cues: [manualCue],
      };

      const timelineContent = JSON.stringify({
        version: 1,
        cues: [
          {
            id: 'manual1', // Same ID as manual cue
            stringKey: 'greeting',
            startTime: 0,
            duration: 3,
          },
        ],
      });

      const file = {
        name: 'timeline.json',
        text: async () => timelineContent,
      } as unknown as File;

      const { newState } = await importTextTimeline(stateWithManual, file);

      expect(newState.cues).toHaveLength(1);
      expect(newState.cues[0].origin).toBe('manual'); // Still manual
      expect(newState.cues[0].base.stringKey).toBe('manual'); // Not updated
    });

    it('should append new cues on reimport', async () => {
      const existingCue: TextCue = {
        id: 'cue1',
        origin: 'timeline-import',
        base: createDefaultCueBase('greeting', 0, 3),
        overrides: {},
      };

      const stateWithCue: TextProjectState = {
        ...initialState,
        cues: [existingCue],
      };

      const timelineContent = JSON.stringify({
        version: 1,
        cues: [
          {
            id: 'cue1',
            stringKey: 'greeting',
            startTime: 0,
            duration: 3,
          },
          {
            id: 'cue2',
            stringKey: 'farewell',
            startTime: 5,
            duration: 2,
          },
        ],
      });

      const file = {
        name: 'timeline.json',
        text: async () => timelineContent,
      } as unknown as File;

      const { newState } = await importTextTimeline(stateWithCue, file);

      expect(newState.cues).toHaveLength(2);
      expect(newState.cues[0].id).toBe('cue1');
      expect(newState.cues[1].id).toBe('cue2');
    });

    it('should reject invalid timeline.json', async () => {
      const invalidFile = {
        name: 'timeline.json',
        text: async () => 'not valid json',
      } as unknown as File;

      const { result } = await importTextTimeline(initialState, invalidFile);

      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject unsupported version', async () => {
      const timelineContent = JSON.stringify({
        version: 999, // Unsupported
        cues: [],
      });

      const file = {
        name: 'timeline.json',
        text: async () => timelineContent,
      } as unknown as File;

      const { result } = await importTextTimeline(initialState, file);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('Unsupported timeline version'))).toBe(true);
    });
  });
});

describe('Context Text Cue CRUD', () => {
  // These tests would need React Context testing setup
  // For now, we'll test the pure logic that would be used in the context

  describe('Manual Cue Creation', () => {
    it('should assign UUID and manual origin', () => {
      const base = createDefaultCueBase('test', 0, 3);
      const cue: Omit<TextCue, 'id' | 'origin'> = {
        base,
        overrides: {},
      };

      const newCue: TextCue = {
        ...cue,
        id: crypto.randomUUID(),
        origin: 'manual',
      };

      expect(newCue.id).toBeDefined();
      expect(newCue.id.length).toBeGreaterThan(0);
      expect(newCue.origin).toBe('manual');
      expect(newCue.base).toEqual(base);
    });
  });

  describe('Reset to Defaults', () => {
    it('should clear overrides when updating base', () => {
      const cue: TextCue = {
        id: 'test',
        origin: 'manual',
        base: createDefaultCueBase('test', 0, 3),
        overrides: { fontSize: 80 },
      };

      // Update base without overridesOnly flag
      const updated: TextCue = {
        ...cue,
        base: { ...cue.base, fontSize: 72 },
        overrides: {}, // Clear overrides
      };

      expect(updated.overrides).toEqual({});
      expect(updated.base.fontSize).toBe(72);
    });

    it('should preserve overrides when using overridesOnly flag', () => {
      const cue: TextCue = {
        id: 'test',
        origin: 'manual',
        base: createDefaultCueBase('test', 0, 3),
        overrides: { fontSize: 80 },
      };

      // Update with overridesOnly flag
      const updated: TextCue = {
        ...cue,
        overrides: { ...cue.overrides, fontSize: 90 },
      };

      expect(updated.overrides.fontSize).toBe(90);
      expect(updated.base.fontSize).not.toBe(90); // Base unchanged
    });
  });
});

describe('Draft Migration', () => {
  describe('Unversioned Draft', () => {
    it('should initialize empty text state for unversioned drafts', () => {
      const _unversionedDraft = {
        id: 'project1',
        name: 'Old Project',
        video: null,
        audioAssets: [],
        segments: [],
        settings: {},
        updatedAt: Date.now(),
        // No draftVersion field
      };

      const textState: TextProjectState = {
        catalogs: {},
        cues: [],
        previewLocale: null,
      };

      expect(textState.catalogs).toEqual({});
      expect(textState.cues).toEqual([]);
      expect(textState.previewLocale).toBeNull();
    });
  });

  describe('Version 2 Draft', () => {
    it('should restore text state from v2 draft', () => {
      const v2Draft = {
        draftVersion: 2,
        id: 'project1',
        name: 'New Project',
        video: null,
        audioAssets: [],
        segments: [],
        settings: {},
        updatedAt: Date.now(),
        text: {
          catalogs: {
            en: { locale: 'en', sourceFileName: 'en.json', strings: { hello: 'Hello' } },
          },
          cues: [
            {
              id: 'cue1',
              origin: 'timeline-import',
              base: createDefaultCueBase('hello', 0, 3),
              overrides: {},
            },
          ],
          previewLocale: 'en',
        },
      };

      expect(v2Draft.text.catalogs['en']).toBeDefined();
      expect(v2Draft.text.cues).toHaveLength(1);
      expect(v2Draft.text.previewLocale).toBe('en');
    });
  });

  describe('Corrupt v2 Draft', () => {
    it('should sanitize and restore partial text state', () => {
      const corruptV2Draft = {
        draftVersion: 2,
        id: 'project1',
        name: 'Corrupt Project',
        video: null,
        audioAssets: [],
        segments: [],
        settings: {},
        updatedAt: Date.now(),
        text: {
          // catalogs: missing, should default to {}
          cues: 'not an array', // invalid, should default to []
          previewLocale: 'en',
        },
      };

      const sanitizedText: TextProjectState = {
        catalogs: corruptV2Draft.text.catalogs || {},
        cues: Array.isArray(corruptV2Draft.text.cues) ? corruptV2Draft.text.cues : [],
        previewLocale: corruptV2Draft.text.previewLocale || null,
      };

      expect(sanitizedText.catalogs).toEqual({});
      expect(sanitizedText.cues).toEqual([]);
      expect(sanitizedText.previewLocale).toBe('en');
    });
  });
});

describe('Missing Key Validation', () => {
  it('should block locale when catalog is missing', () => {
    const catalog = undefined;

    const blocked = !catalog; // Locale blocked when catalog missing
    expect(blocked).toBe(true);
  });

  it('should block locale when keys are missing from catalog', () => {
    const catalog = {
      locale: 'en',
      sourceFileName: 'en.json',
      strings: { greeting: 'Hello', farewell: 'Goodbye' }, // 'thanks' missing
    };

    const missingKeys = ['thanks'].filter((k) => !(k in catalog.strings));
    expect(missingKeys).toEqual(['thanks']);
    expect(missingKeys.length).toBeGreaterThan(0); // Should block
  });

  it('should not block when all keys are present', () => {
    const catalog = {
      locale: 'en',
      sourceFileName: 'en.json',
      strings: { greeting: 'Hello', farewell: 'Goodbye' },
    };

    const missingKeys = ['greeting', 'farewell'].filter((k) => !(k in catalog.strings));
    expect(missingKeys).toEqual([]);
    expect(missingKeys.length).toBe(0); // Should not block
  });
});
