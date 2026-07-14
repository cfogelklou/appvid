import { describe, expect, it } from 'vitest';
import { buildExportFilename, resolveCollision, sanitizeName } from '../../src/text';

describe('exportFilename.sanitizeName', () => {
  it('lowercases and collapses non-alphanumerics to dashes', () => {
    expect(sanitizeName('My Project!')).toBe('my-project');
    expect(sanitizeName('Appstore Portrait')).toBe('appstore-portrait');
    expect(sanitizeName('a---b')).toBe('a-b');
  });
  it('falls back to untitled for empty input', () => {
    expect(sanitizeName('')).toBe('untitled');
    expect(sanitizeName('!!!')).toBe('untitled');
  });
});

describe('exportFilename.buildExportFilename', () => {
  it('formats project-preset-locale.mp4 with canonical locale', () => {
    expect(
      buildExportFilename({
        projectName: 'My App',
        presetName: 'Appstore Portrait',
        locale: 'pt-BR',
      }),
    ).toBe('my-app-appstore-portrait-pt-BR.mp4');
    expect(
      buildExportFilename({ projectName: 'Demo', presetName: 'Landscape', locale: 'ja' }),
    ).toBe('demo-landscape-ja.mp4');
  });
  it('respects a custom extension', () => {
    expect(
      buildExportFilename({ projectName: 'X', presetName: 'Y', locale: 'en', extension: 'webm' }),
    ).toBe('x-y-en.webm');
  });
});

describe('exportFilename.resolveCollision', () => {
  it('returns the base name when not taken', () => {
    expect(resolveCollision('x.mp4', [])).toBe('x.mp4');
    expect(resolveCollision('x.mp4', ['y.mp4'])).toBe('x.mp4');
  });
  it('appends -2, -3 for collisions without overwriting', () => {
    expect(resolveCollision('x.mp4', ['x.mp4'])).toBe('x-2.mp4');
    expect(resolveCollision('x.mp4', ['x.mp4', 'x-2.mp4'])).toBe('x-3.mp4');
    expect(resolveCollision('x.mp4', ['x.mp4', 'x-2.mp4', 'x-3.mp4'])).toBe('x-4.mp4');
  });
});
