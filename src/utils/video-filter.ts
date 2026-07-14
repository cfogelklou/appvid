/**
 * FFmpeg drawtext filter construction for multilingual text overlays.
 * Agent D (Wave 2) implementation. Consumes LaidOutTextCue layout contract.
 */

import type { LaidOutTextCue } from '../text/types';

const ensureDirectory = async (
  ffmpeg: { createDir: (path: string) => Promise<unknown> },
  path: string,
) => {
  try {
    await ffmpeg.createDir(path);
  } catch (error) {
    // Directories remain in the shared FFmpeg instance between batch items.
    // A second create therefore legitimately reports that the path exists.
    if (!String(error).includes('File exists')) throw error;
  }
};

/**
 * Position text block within safe area using horizontal alignment.
 */
const calculateBlockX = (cue: LaidOutTextCue): number => {
  const { safeAreaInset, contentWidth, blockWidth, horizontalAlign } = cue;

  switch (horizontalAlign) {
    case 'left':
      return safeAreaInset;
    case 'center':
      return safeAreaInset + (contentWidth - blockWidth) / 2;
    case 'right':
      return safeAreaInset + contentWidth - blockWidth;
    default:
      return safeAreaInset;
  }
};

/**
 * Position text block within safe area using vertical alignment.
 */
const calculateBlockY = (cue: LaidOutTextCue, frameHeight: number): number => {
  const { blockHeight, verticalAlign } = cue;

  // Calculate vertical safe area inset (5% of frame height)
  const insetY = frameHeight * 0.05;
  const contentHeight = frameHeight - 2 * insetY;

  switch (verticalAlign) {
    case 'top':
      return insetY;
    case 'middle':
      return insetY + (contentHeight - blockHeight) / 2;
    case 'bottom':
      return insetY + contentHeight - blockHeight;
    default:
      return insetY + contentHeight - blockHeight;
  }
};

/**
 * Build a single drawtext filter for one line of text.
 */
const buildDrawtextFilter = (
  _lineText: string,
  lineIndex: number,
  cue: LaidOutTextCue,
  blockX: number,
  blockY: number,
  inputLabel: string,
  outputLabel: string,
): string => {
  // Line position within the block
  const lineY = blockY + lineIndex * cue.lineHeight;

  // Sanitize color: remove # prefix for drawtext
  const color = cue.color.slice(1);

  // Build filter string
  const parts = [
    `textfile=text/line_${cue.id}_${lineIndex}.txt`,
    `fontfile=fonts/${cue.fontFileName}`,
    `fontsize=${cue.fontSize}`,
    `fontcolor=${color}`,
    `x=${blockX.toFixed(3)}`,
    `y=${lineY.toFixed(3)}`,
    `enable='between(t,${cue.startTime.toFixed(3)},${cue.stopTime.toFixed(3)})'`,
  ];

  return `${inputLabel}drawtext=${parts.join(':')}${outputLabel}`;
};

/**
 * Build the complete video filter chain with text overlays.
 *
 * @param baseVideoFilter - The existing video filter (scale/pad/crop) ending in [out_v] or similar
 * @param textOverlays - Array of laid out cues to render
 * @param _frameWidth - Output frame width from project settings (currently unused, reserved for future)
 * @param frameHeight - Output frame height from project settings
 * @returns Complete filter complex string
 */
export const buildTextOverlayFilterChain = (
  baseVideoFilter: string,
  textOverlays: LaidOutTextCue[],
  _frameWidth: number,
  frameHeight: number,
): string => {
  if (textOverlays.length === 0) {
    return baseVideoFilter;
  }

  // Start with the base video filter (trim/scale/pad/crop)
  // It should end with a label like [out_v], [vscaled], etc.
  // We'll chain text filters after it

  let currentLabel = baseVideoFilter.match(/\[[\w]+\]$/)?.[0] || '[vscaled]';
  let filterChain = baseVideoFilter;

  // Sort cues by start time to ensure deterministic ordering
  const sortedCues = [...textOverlays].sort((a, b) => a.startTime - b.startTime);

  for (const cue of sortedCues) {
    const blockX = calculateBlockX(cue);
    const blockY = calculateBlockY(cue, frameHeight);

    // Process each line separately
    for (let lineIndex = 0; lineIndex < cue.lines.length; lineIndex++) {
      const outputLabel = `[vtext_${cue.id}_${lineIndex}]`;
      const filter = buildDrawtextFilter(
        cue.lines[lineIndex],
        lineIndex,
        cue,
        blockX,
        blockY,
        currentLabel,
        outputLabel,
      );

      filterChain += `;${filter}`;
      currentLabel = outputLabel;
    }
  }

  // Final output label
  filterChain = filterChain.replace(/\[[\w]+\]$/, '[vout]');

  return filterChain;
};

/**
 * Get list of text files that need to be written for the overlays.
 */
export const getRequiredTextFiles = (textOverlays: LaidOutTextCue[]): string[] => {
  const files: string[] = [];

  for (const cue of textOverlays) {
    for (let lineIndex = 0; lineIndex < cue.lines.length; lineIndex++) {
      files.push(`text/line_${cue.id}_${lineIndex}.txt`);
    }
  }

  return files;
};

/**
 * Write text files for all overlay lines to FFmpeg virtual filesystem.
 */
export const writeTextFiles = async (
  ffmpeg: {
    createDir: (path: string) => Promise<unknown>;
    writeFile: (path: string, data: Uint8Array) => Promise<unknown>;
  },
  textOverlays: LaidOutTextCue[],
): Promise<string[]> => {
  const writtenFiles: string[] = [];

  await ensureDirectory(ffmpeg, 'text');

  for (const cue of textOverlays) {
    for (let lineIndex = 0; lineIndex < cue.lines.length; lineIndex++) {
      const filename = `text/line_${cue.id}_${lineIndex}.txt`;
      const content = cue.lines[lineIndex];

      await ffmpeg.writeFile(filename, new TextEncoder().encode(content));
      writtenFiles.push(filename);
    }
  }

  return writtenFiles;
};

/**
 * Get list of font files that need to be staged.
 */
export const getRequiredFontFiles = (textOverlays: LaidOutTextCue[]): Set<string> => {
  const fonts = new Set<string>();

  for (const cue of textOverlays) {
    fonts.add(cue.fontFileName);
  }

  return fonts;
};

/**
 * Copy font files from public/fonts to FFmpeg virtual filesystem.
 */
export const stageFontFiles = async (
  ffmpeg: {
    createDir: (path: string) => Promise<unknown>;
    writeFile: (path: string, data: Uint8Array) => Promise<unknown>;
  },
  fontFiles: Set<string>,
): Promise<string[]> => {
  const stagedFiles: string[] = [];

  await ensureDirectory(ffmpeg, 'fonts');

  for (const fontFileName of fontFiles) {
    const sourcePath = `${import.meta.env.BASE_URL}fonts/${fontFileName}`;
    const destPath = `fonts/${fontFileName}`;

    try {
      // Fetch from public/fonts
      const response = await fetch(sourcePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${sourcePath}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      await ffmpeg.writeFile(destPath, new Uint8Array(arrayBuffer));
      stagedFiles.push(destPath);
    } catch (error) {
      console.error(`Failed to stage font ${fontFileName}:`, error);
      throw error;
    }
  }

  return stagedFiles;
};
