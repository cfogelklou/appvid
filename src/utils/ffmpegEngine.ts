import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { Project } from '../types';
import { getEditedVideoDuration } from '../context/ProjectContext';
import type { LaidOutTextCue, LocaleCode } from '../text/types';
import {
  buildTextOverlayFilterChain,
  getRequiredFontFiles,
  stageFontFiles,
  writeTextFiles,
} from './video-filter';

export interface ProcessLog {
  timestamp: number;
  message: string;
}

export interface ProgressData {
  stage: string;
  progress: number; // 0 to 1
  message?: string;
}

let ffmpegInstance: FFmpeg | null = null;

const getExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/**
 * Initializes and loads the single-threaded FFmpeg instance if not already loaded.
 */
export async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) {
    if (onLog) {
      // Re-register log listener if provided
      ffmpegInstance.on('log', ({ message }) => onLog(message));
    }
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  // Single-threaded core URL
  await ffmpeg.load({
    coreURL: await toBlobURL('/appvid/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/appvid/ffmpeg-core.wasm', 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Resets the cached FFmpeg instance. Must be called if exit() is triggered.
 */
export function resetFFmpegInstance() {
  ffmpegInstance = null;
}

/**
 * Runs local video/audio processing via FFmpeg WASM.
 */
export async function processVideo(
  project: Project,
  onProgress: (data: ProgressData) => void,
  onLog: (log: ProcessLog) => void,
  signal?: AbortSignal
): Promise<Blob> {
  if (!project.video) {
    throw new Error('No video imported in project');
  }

  const logsCollector: ProcessLog[] = [];
  const logCallback = (message: string) => {
    const logObj = { timestamp: Date.now(), message };
    logsCollector.push(logObj);
    onLog(logObj);
  };

  onProgress({ stage: 'Loading local video engine', progress: 0.0 });
  const ffmpeg = await getFFmpeg(logCallback);

  // Set up cancellation handler
  const abortHandler = () => {
    try {
      ffmpeg.terminate();
    } catch (e) {
      console.warn('Error during FFmpeg terminate:', e);
    }
    resetFFmpegInstance();
  };

  if (signal) {
    signal.addEventListener('abort', abortHandler);
  }

  // Set up progress listener
  const progressCallback = ({ progress }: { progress: number }) => {
    // Map H.264 encode progress (0.0 to 1.0) to overall scale (0.4 to 0.95)
    const scaledProgress = 0.4 + progress * 0.55;
    onProgress({
      stage: 'Encoding high-quality MP4',
      progress: Math.min(0.95, Math.max(0.4, scaledProgress)),
      message: `${Math.round(progress * 100)}% encoded`
    });
  };
  ffmpeg.on('progress', progressCallback);

  const cleanupVirtualFiles: string[] = [];

  try {
    onProgress({ stage: 'Preparing media files', progress: 0.1 });

    // 1. Fetch and write input video file
    const videoExt = getExtension(project.video.name) || 'mp4';
    const videoFilename = `input_video.${videoExt}`;
    logCallback(`Fetching source video from Blob URL...`);
    const videoBlobResponse = await fetch(project.video.blobUrl);
    const videoArrayBuffer = await videoBlobResponse.arrayBuffer();

    logCallback(`Writing source video to virtual filesystem: ${videoFilename}`);
    await ffmpeg.writeFile(videoFilename, new Uint8Array(videoArrayBuffer));
    cleanupVirtualFiles.push(videoFilename);

    // 2. Determine if the video has an audio stream by probing it
    let hasAudio = false;
    const probeLogCallback = ({ message }: { message: string }) => {
      if (message.includes('Audio:')) {
        hasAudio = true;
      }
    };
    ffmpeg.on('log', probeLogCallback);
    try {
      logCallback('Probing input video streams...');
      await ffmpeg.exec(['-i', videoFilename]);
    } catch {
      // ffmpeg exec without output returns non-zero, this is normal
    }
    ffmpeg.off('log', probeLogCallback);
    logCallback(`Source video has audio stream: ${hasAudio}`);

    // 3. Fetch and write unique audio files
    onProgress({ stage: 'Preparing media files', progress: 0.25 });
    const uniqueAssetIds = Array.from(new Set(project.segments.map(s => s.assetId)));
    const assetIdToFilename: Record<string, string> = {};

    for (const assetId of uniqueAssetIds) {
      const asset = project.audioAssets.find(a => a.id === assetId);
      if (!asset) {
        throw new Error(`Audio asset not found: ${assetId}`);
      }
      const audioExt = getExtension(asset.name) || 'mp3';
      const audioFilename = `audio_${assetId}.${audioExt}`;

      logCallback(`Fetching audio asset "${asset.name}" from Blob URL...`);
      const audioBlobResponse = await fetch(asset.blobUrl);
      const audioArrayBuffer = await audioBlobResponse.arrayBuffer();

      logCallback(`Writing audio asset to virtual filesystem: ${audioFilename}`);
      await ffmpeg.writeFile(audioFilename, new Uint8Array(audioArrayBuffer));
      cleanupVirtualFiles.push(audioFilename);

      assetIdToFilename[assetId] = audioFilename;
    }

    // 4. Build command arguments
    onProgress({ stage: 'Applying store preset', progress: 0.35 });
    const tw = project.settings.width;
    const th = project.settings.height;
    const fitMode = project.settings.fitMode;
    const targetRatio = tw / th;

    const segments = project.videoSegments || [];
    const videoFilters: string[] = [];
    let videoSourceLabel = '[0:v]';

    if (segments.length === 1) {
      const S = segments[0];
      const clipEnd = S.clipStart + S.duration * S.playbackRate;
      videoFilters.push(`[0:v]trim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},setpts=(PTS-STARTPTS)/${S.playbackRate.toFixed(3)}[trimmed_v]`);
      videoSourceLabel = '[trimmed_v]';
    } else if (segments.length > 1) {
      const concatLabels: string[] = [];
      segments.forEach((S, idx) => {
        const clipEnd = S.clipStart + S.duration * S.playbackRate;
        videoFilters.push(`[0:v]trim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},setpts=(PTS-STARTPTS)/${S.playbackRate.toFixed(3)}[v_seg_${idx}]`);
        concatLabels.push(`[v_seg_${idx}]`);
      });
      videoFilters.push(`${concatLabels.join('')}concat=n=${segments.length}:v=1:a=0[trimmed_v]`);
      videoSourceLabel = '[trimmed_v]';
    }

    // Video Filter Chain
    let videoFilter = '';
    if (fitMode === 'fit') {
      videoFilter = `${videoSourceLabel}scale=w='if(gt(iw/ih,${targetRatio}),${tw},-2)':h='if(gt(iw/ih,${targetRatio}),-2,${th})',pad=w=${tw}:h=${th}:x='(ow-iw)/2':y='(oh-ih)/2':color=black[out_v]`;
    } else {
      // fill (crop)
      videoFilter = `${videoSourceLabel}scale=w='if(gt(iw/ih,${targetRatio}),-2,${tw})':h='if(gt(iw/ih,${targetRatio}),${th},-2)',crop=w=${tw}:h=${th}:x='(iw-ow)/2':y='(ih-oh)/2'[out_v]`;
    }

    if (videoFilters.length > 0) {
      videoFilter = videoFilters.join(';') + ';' + videoFilter;
    }

    // Audio Inputs and Filter Chains
    const audioInputs: string[] = [];
    const audioLabelList: string[] = [];
    const audioFilters: string[] = [];

    const buildAudioTempoFilter = (rate: number): string => {
      const parts: string[] = [];
      let remaining = rate;
      while (remaining > 2.0) {
        parts.push('atempo=2.0');
        remaining /= 2.0;
      }
      if (remaining > 0.5) {
        parts.push(`atempo=${remaining.toFixed(3)}`);
      }
      return parts.join(',');
    };

    // Check if we should keep original audio
    if (project.settings.originalAudioMode === 'keep' && hasAudio) {
      let origAudioLabel = '';
      if (segments.length === 1) {
        const S = segments[0];
        const clipEnd = S.clipStart + S.duration * S.playbackRate;
        const tempo = buildAudioTempoFilter(S.playbackRate);
        const tempoStr = tempo ? `,${tempo}` : '';
        audioFilters.push(`[0:a]atrim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},asetpts=PTS-STARTPTS${tempoStr}[trimmed_a]`);
        origAudioLabel = '[trimmed_a]';
      } else if (segments.length > 1) {
        const concatLabels: string[] = [];
        segments.forEach((S, idx) => {
          const clipEnd = S.clipStart + S.duration * S.playbackRate;
          const tempo = buildAudioTempoFilter(S.playbackRate);
          const tempoStr = tempo ? `,${tempo}` : '';
          audioFilters.push(`[0:a]atrim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},asetpts=PTS-STARTPTS${tempoStr}[a_seg_${idx}]`);
          concatLabels.push(`[a_seg_${idx}]`);
        });
        audioFilters.push(`${concatLabels.join('')}concat=n=${segments.length}:v=0:a=1[trimmed_a]`);
        origAudioLabel = '[trimmed_a]';
      } else {
        origAudioLabel = '[0:a]';
      }

      audioFilters.push(`${origAudioLabel}volume=volume=1.0[aud_orig]`);
      audioLabelList.push('[aud_orig]');
    }

    // Map segments to inputs starting at index 1 (index 0 is the video input)
    project.segments.forEach((segment, idx) => {
      const filename = assetIdToFilename[segment.assetId];
      if (filename) {
        audioInputs.push('-i', filename);
        const inputIdx = 1 + idx; // video is 0, so segments start at 1
        const delayMs = Math.round(Math.max(0, segment.startTime) * 1000);

        const asset = project.audioAssets.find((a) => a.id === segment.assetId);
        const assetDuration = asset ? asset.duration : 0;
        const duration = segment.duration !== undefined ? segment.duration : assetDuration;
        const clipStart = segment.clipStart !== undefined ? segment.clipStart : 0;
        const clipEnd = clipStart + duration;

        const filterStr = `[${inputIdx}:a]atrim=start=${clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},asetpts=PTS-STARTPTS,volume=volume=${segment.volume},adelay=delays=${delayMs}:all=1[aud_${idx}]`;
        audioFilters.push(filterStr);
        audioLabelList.push(`[aud_${idx}]`);
      }
    });

    let filterComplex = videoFilter;
    if (audioFilters.length > 0) {
      filterComplex += ';' + audioFilters.join(';');
    }

    if (audioLabelList.length === 0) {
      // Generate silence if no audio is selected
      filterComplex += `;anullsrc=channel_layout=stereo:sample_rate=48000[out_a]`;
    } else if (audioLabelList.length === 1) {
      // Rename single stream to [out_a]
      filterComplex += `;${audioLabelList[0]}anull[out_a]`;
    } else {
      // Mix multiple audio streams using amix
      filterComplex += `;${audioLabelList.join('')}amix=inputs=${audioLabelList.length}:normalize=0:dropout_transition=99999[out_a]`;
    }

    const execArgs = [
      '-i', videoFilename,
      ...audioInputs,
      '-filter_complex', filterComplex,
      '-map', '[out_v]',
      '-map', '[out_a]',
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '22',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-ac', '2',
      '-ar', '48000',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-t', getEditedVideoDuration(project).toFixed(3),
      'output.mp4'
    ];

    logCallback(`Executing FFmpeg command: ffmpeg ${execArgs.join(' ')}`);

    onProgress({ stage: 'Encoding high-quality MP4', progress: 0.4 });

    // Execute command!
    await ffmpeg.exec(execArgs);

    // 5. Read output file
    onProgress({ stage: 'Preparing download', progress: 0.96 });
    logCallback('Reading generated output.mp4 from virtual filesystem...');
    const outData = await ffmpeg.readFile('output.mp4');

    logCallback('Export complete! Creating final Blob...');
    const uint8Data = outData instanceof Uint8Array ? outData : new Uint8Array();
    const outBlob = new Blob([uint8Data.buffer as ArrayBuffer], { type: 'video/mp4' });

    // Cleanup output file
    try {
      await ffmpeg.deleteFile('output.mp4');
    } catch (e) {
      console.warn('Failed to delete output.mp4:', e);
    }

    onProgress({ stage: 'Export Complete', progress: 1.0 });
    return outBlob;

  } catch (error: any) {
    logCallback(`ERROR: ${error.message || error}`);
    if (signal?.aborted) {
      throw new Error('Export cancelled by user');
    }
    throw error;
  } finally {
    // Clean up event listeners
    ffmpeg.off('progress', progressCallback);
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }

    // Clean up virtual filesystem input files to prevent memory leak
    logCallback('Cleaning up virtual filesystem...');
    for (const filename of cleanupVirtualFiles) {
      try {
        await ffmpeg.deleteFile(filename);
      } catch (e) {
        console.warn(`Failed to delete virtual file: ${filename}`, e);
      }
    }
  }
}

/** Extended render options for locale-specific text rendering. */
export interface RenderVideoOptions {
  /** If set, render one locale with text overlays. */
  locale?: LocaleCode;
  /** Pre-computed text layouts from layoutCue(). */
  textOverlays?: LaidOutTextCue[];
  /** Cancellation signal. */
  signal?: AbortSignal;
}

/** Callbacks for render progress and logging. */
export interface RenderCallbacks {
  onProgress: (data: ProgressData) => void;
  onLog: (log: ProcessLog) => void;
}

/**
 * Extended video renderer with multilingual text overlay support.
 * When options.locale is absent, behaves identically to processVideo (no text).
 * When options.locale is present, renders text using pre-computed LaidOutTextCue layouts.
 */
export async function renderVideo(
  project: Project,
  options: RenderVideoOptions,
  callbacks: RenderCallbacks,
): Promise<Blob> {
  const { onProgress, onLog } = callbacks;
  const { locale, textOverlays, signal } = options;

  if (!project.video) {
    throw new Error('No video imported in project');
  }

  // Backward compatibility: if no locale specified, use original processVideo behavior
  if (!locale || !textOverlays || textOverlays.length === 0) {
    return processVideo(project, onProgress, onLog, signal);
  }

  const logsCollector: ProcessLog[] = [];
  const logCallback = (message: string) => {
    const logObj = { timestamp: Date.now(), message };
    logsCollector.push(logObj);
    onLog(logObj);
  };

  onProgress({ stage: 'Loading local video engine', progress: 0.0 });
  const ffmpeg = await getFFmpeg(logCallback);

  // Set up cancellation handler
  const abortHandler = () => {
    try {
      ffmpeg.terminate();
    } catch (e) {
      console.warn('Error during FFmpeg terminate:', e);
    }
    resetFFmpegInstance();
  };

  if (signal) {
    signal.addEventListener('abort', abortHandler);
  }

  // Set up progress listener
  const progressCallback = ({ progress }: { progress: number }) => {
    // Map H.264 encode progress (0.0 to 1.0) to overall scale (0.4 to 0.95)
    const scaledProgress = 0.4 + progress * 0.55;
    onProgress({
      stage: 'Encoding high-quality MP4',
      progress: Math.min(0.95, Math.max(0.4, scaledProgress)),
      message: `${Math.round(progress * 100)}% encoded`
    });
  };
  ffmpeg.on('progress', progressCallback);

  const cleanupVirtualFiles: string[] = [];

  try {
    onProgress({ stage: 'Preparing media files', progress: 0.1 });

    // 1. Fetch and write input video file
    const videoExt = getExtension(project.video.name) || 'mp4';
    const videoFilename = `input_video.${videoExt}`;
    logCallback(`Fetching source video from Blob URL...`);
    const videoBlobResponse = await fetch(project.video.blobUrl);
    const videoArrayBuffer = await videoBlobResponse.arrayBuffer();

    logCallback(`Writing source video to virtual filesystem: ${videoFilename}`);
    await ffmpeg.writeFile(videoFilename, new Uint8Array(videoArrayBuffer));
    cleanupVirtualFiles.push(videoFilename);

    // 2. Determine if the video has an audio stream by probing it
    let hasAudio = false;
    const probeLogCallback = ({ message }: { message: string }) => {
      if (message.includes('Audio:')) {
        hasAudio = true;
      }
    };
    ffmpeg.on('log', probeLogCallback);
    try {
      logCallback('Probing input video streams...');
      await ffmpeg.exec(['-i', videoFilename]);
    } catch {
      // ffmpeg exec without output returns non-zero, this is normal
    }
    ffmpeg.off('log', probeLogCallback);
    logCallback(`Source video has audio stream: ${hasAudio}`);

    // 3. Fetch and write unique audio files
    onProgress({ stage: 'Preparing media files', progress: 0.25 });
    const uniqueAssetIds = Array.from(new Set(project.segments.map(s => s.assetId)));
    const assetIdToFilename: Record<string, string> = {};

    for (const assetId of uniqueAssetIds) {
      const asset = project.audioAssets.find(a => a.id === assetId);
      if (!asset) {
        throw new Error(`Audio asset not found: ${assetId}`);
      }
      const audioExt = getExtension(asset.name) || 'mp3';
      const audioFilename = `audio_${assetId}.${audioExt}`;

      logCallback(`Fetching audio asset "${asset.name}" from Blob URL...`);
      const audioBlobResponse = await fetch(asset.blobUrl);
      const audioArrayBuffer = await audioBlobResponse.arrayBuffer();

      logCallback(`Writing audio asset to virtual filesystem: ${audioFilename}`);
      await ffmpeg.writeFile(audioFilename, new Uint8Array(audioArrayBuffer));
      cleanupVirtualFiles.push(audioFilename);

      assetIdToFilename[assetId] = audioFilename;
    }

    // 4. Stage font files for text rendering
    onProgress({ stage: 'Staging fonts for text rendering', progress: 0.3 });
    const requiredFonts = getRequiredFontFiles(textOverlays);
    logCallback(`Staging ${requiredFonts.size} font files: ${Array.from(requiredFonts).join(', ')}`);
    const stagedFontFiles = await stageFontFiles(ffmpeg, requiredFonts);
    cleanupVirtualFiles.push(...stagedFontFiles);

    // 5. Write text files for all overlay lines
    onProgress({ stage: 'Preparing text overlays', progress: 0.32 });
    logCallback(`Writing ${textOverlays.length} text overlays to virtual filesystem`);
    const writtenTextFiles = await writeTextFiles(ffmpeg, textOverlays);
    cleanupVirtualFiles.push(...writtenTextFiles);

    // 6. Build command arguments
    onProgress({ stage: 'Applying store preset', progress: 0.35 });
    const tw = project.settings.width;
    const th = project.settings.height;
    const fitMode = project.settings.fitMode;
    const targetRatio = tw / th;

    const segments = project.videoSegments || [];
    const videoFilters: string[] = [];
    let videoSourceLabel = '[0:v]';

    if (segments.length === 1) {
      const S = segments[0];
      const clipEnd = S.clipStart + S.duration * S.playbackRate;
      videoFilters.push(`[0:v]trim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},setpts=(PTS-STARTPTS)/${S.playbackRate.toFixed(3)}[trimmed_v]`);
      videoSourceLabel = '[trimmed_v]';
    } else if (segments.length > 1) {
      const concatLabels: string[] = [];
      segments.forEach((S, idx) => {
        const clipEnd = S.clipStart + S.duration * S.playbackRate;
        videoFilters.push(`[0:v]trim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},setpts=(PTS-STARTPTS)/${S.playbackRate.toFixed(3)}[v_seg_${idx}]`);
        concatLabels.push(`[v_seg_${idx}]`);
      });
      videoFilters.push(`${concatLabels.join('')}concat=n=${segments.length}:v=1:a=0[trimmed_v]`);
      videoSourceLabel = '[trimmed_v]';
    }

    // Video Filter Chain (base: scale/pad/crop)
    let baseVideoFilter = '';
    if (fitMode === 'fit') {
      baseVideoFilter = `${videoSourceLabel}scale=w='if(gt(iw/ih,${targetRatio}),${tw},-2)':h='if(gt(iw/ih,${targetRatio}),-2,${th})',pad=w=${tw}:h=${th}:x='(ow-iw)/2':y='(oh-ih)/2':color=black[out_v]`;
    } else {
      // fill (crop)
      baseVideoFilter = `${videoSourceLabel}scale=w='if(gt(iw/ih,${targetRatio}),-2,${tw})':h='if(gt(iw/ih,${targetRatio}),${th},-2)',crop=w=${tw}:h=${th}:x='(iw-ow)/2':y='(ih-oh)/2'[out_v]`;
    }

    if (videoFilters.length > 0) {
      baseVideoFilter = videoFilters.join(';') + ';' + baseVideoFilter;
    }

    // Add text overlay filters to the chain
    const videoFilter = buildTextOverlayFilterChain(
      baseVideoFilter,
      textOverlays,
      tw,
      th,
    );

    // Audio Inputs and Filter Chains
    const audioInputs: string[] = [];
    const audioLabelList: string[] = [];
    const audioFilters: string[] = [];

    const buildAudioTempoFilter = (rate: number): string => {
      const parts: string[] = [];
      let remaining = rate;
      while (remaining > 2.0) {
        parts.push('atempo=2.0');
        remaining /= 2.0;
      }
      if (remaining > 0.5) {
        parts.push(`atempo=${remaining.toFixed(3)}`);
      }
      return parts.join(',');
    };

    // Check if we should keep original audio
    if (project.settings.originalAudioMode === 'keep' && hasAudio) {
      let origAudioLabel = '';
      if (segments.length === 1) {
        const S = segments[0];
        const clipEnd = S.clipStart + S.duration * S.playbackRate;
        const tempo = buildAudioTempoFilter(S.playbackRate);
        const tempoStr = tempo ? `,${tempo}` : '';
        audioFilters.push(`[0:a]atrim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},asetpts=PTS-STARTPTS${tempoStr}[trimmed_a]`);
        origAudioLabel = '[trimmed_a]';
      } else if (segments.length > 1) {
        const concatLabels: string[] = [];
        segments.forEach((S, idx) => {
          const clipEnd = S.clipStart + S.duration * S.playbackRate;
          const tempo = buildAudioTempoFilter(S.playbackRate);
          const tempoStr = tempo ? `,${tempo}` : '';
          audioFilters.push(`[0:a]atrim=start=${S.clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},asetpts=PTS-STARTPTS${tempoStr}[a_seg_${idx}]`);
          concatLabels.push(`[a_seg_${idx}]`);
        });
        audioFilters.push(`${concatLabels.join('')}concat=n=${segments.length}:v=0:a=1[trimmed_a]`);
        origAudioLabel = '[trimmed_a]';
      } else {
        origAudioLabel = '[0:a]';
      }

      audioFilters.push(`${origAudioLabel}volume=volume=1.0[aud_orig]`);
      audioLabelList.push('[aud_orig]');
    }

    // Map segments to inputs starting at index 1 (index 0 is the video input)
    project.segments.forEach((segment, idx) => {
      const filename = assetIdToFilename[segment.assetId];
      if (filename) {
        audioInputs.push('-i', filename);
        const inputIdx = 1 + idx; // video is 0, so segments start at 1
        const delayMs = Math.round(Math.max(0, segment.startTime) * 1000);

        const asset = project.audioAssets.find((a) => a.id === segment.assetId);
        const assetDuration = asset ? asset.duration : 0;
        const duration = segment.duration !== undefined ? segment.duration : assetDuration;
        const clipStart = segment.clipStart !== undefined ? segment.clipStart : 0;
        const clipEnd = clipStart + duration;

        const filterStr = `[${inputIdx}:a]atrim=start=${clipStart.toFixed(3)}:end=${clipEnd.toFixed(3)},asetpts=PTS-STARTPTS,volume=volume=${segment.volume},adelay=delays=${delayMs}:all=1[aud_${idx}]`;
        audioFilters.push(filterStr);
        audioLabelList.push(`[aud_${idx}]`);
      }
    });

    let filterComplex = videoFilter;
    if (audioFilters.length > 0) {
      filterComplex += ';' + audioFilters.join(';');
    }

    if (audioLabelList.length === 0) {
      // Generate silence if no audio is selected
      filterComplex += `;anullsrc=channel_layout=stereo:sample_rate=48000[out_a]`;
    } else if (audioLabelList.length === 1) {
      // Rename single stream to [out_a]
      filterComplex += `;${audioLabelList[0]}anull[out_a]`;
    } else {
      // Mix multiple audio streams using amix
      filterComplex += `;${audioLabelList.join('')}amix=inputs=${audioLabelList.length}:normalize=0:dropout_transition=99999[out_a]`;
    }

    const execArgs = [
      '-i', videoFilename,
      ...audioInputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[out_a]',
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '22',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-ac', '2',
      '-ar', '48000',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-t', getEditedVideoDuration(project).toFixed(3),
      'output.mp4'
    ];

    logCallback(`Executing FFmpeg command with text overlays: ffmpeg ${execArgs.join(' ')}`);

    onProgress({ stage: 'Encoding high-quality MP4', progress: 0.4 });

    // Execute command!
    await ffmpeg.exec(execArgs);

    // 7. Read output file
    onProgress({ stage: 'Preparing download', progress: 0.96 });
    logCallback('Reading generated output.mp4 from virtual filesystem...');
    const outData = await ffmpeg.readFile('output.mp4');

    logCallback('Export complete! Creating final Blob...');
    const uint8Data = outData instanceof Uint8Array ? outData : new Uint8Array();
    const outBlob = new Blob([uint8Data.buffer as ArrayBuffer], { type: 'video/mp4' });

    // Cleanup output file
    try {
      await ffmpeg.deleteFile('output.mp4');
    } catch (e) {
      console.warn('Failed to delete output.mp4:', e);
    }

    onProgress({ stage: 'Export Complete', progress: 1.0 });
    return outBlob;

  } catch (error: any) {
    logCallback(`ERROR: ${error.message || error}`);
    if (signal?.aborted) {
      throw new Error('Export cancelled by user');
    }
    throw error;
  } finally {
    // Clean up event listeners
    ffmpeg.off('progress', progressCallback);
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }

    // Clean up virtual filesystem input files to prevent memory leak
    logCallback('Cleaning up virtual filesystem...');
    for (const filename of cleanupVirtualFiles) {
      try {
        await ffmpeg.deleteFile(filename);
      } catch (e) {
        console.warn(`Failed to delete virtual file: ${filename}`, e);
      }
    }
  }
}
