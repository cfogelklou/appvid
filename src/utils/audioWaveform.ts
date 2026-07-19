/**
 * Decodes a File object to extract normalized audio amplitude peak values for rendering waveforms.
 * Falls back to generating a realistic pseudo-random envelope if decoding fails.
 */
export const getAudioPeaks = async (file: File, sampleCount = 80): Promise<number[]> => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }
    const audioCtx = new AudioContextClass();
    let audioBuffer: AudioBuffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      // decodeAudioData might not return a promise in older browsers, so wrap it
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
      });
    } finally {
      audioCtx.close();
    }

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / sampleCount);
    const peaks: number[] = [];

    for (let i = 0; i < sampleCount; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(max);
    }

    // Normalize peaks to be between 0.05 and 1.0 for rendering
    const maxPeak = Math.max(...peaks, 0.01);
    return peaks.map((p) => Math.max(0.05, p / maxPeak));
  } catch (err) {
    console.warn('Failed to decode audio peaks, using generated envelope:', err);
    // Return pseudo-random peaks that look like a real audio clip (fade-in, dynamic body, fade-out)
    const fallbackPeaks: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const progress = i / sampleCount;
      const envelope = Math.sin(progress * Math.PI); // bell curve
      const noise = 0.35 + 0.65 * Math.random();
      fallbackPeaks.push(Math.max(0.05, envelope * noise));
    }
    return fallbackPeaks;
  }
};

/**
 * Tries to parse the duration of a WAV file directly from its binary header.
 * Returns the duration in seconds, or null if it fails or is not a WAV file.
 */
export const getWavDuration = async (file: File): Promise<number | null> => {
  try {
    if (!file.name.toLowerCase().endsWith('.wav')) {
      return null;
    }

    // Read the first 44 bytes (standard WAV header size)
    const headerBuffer = await file.slice(0, 44).arrayBuffer();
    const view = new DataView(headerBuffer);

    // Verify RIFF and WAVE signatures
    const isRiff = view.getUint32(0, false) === 0x52494646; // 'RIFF'
    const isWave = view.getUint32(8, false) === 0x57415645; // 'WAVE'
    if (!isRiff || !isWave) {
      return null;
    }

    // Find 'fmt ' chunk
    // Usually fmt chunk starts at byte 12
    const isFmt = view.getUint32(12, false) === 0x666d7420; // 'fmt '
    if (!isFmt) {
      return null;
    }

    const byteRate = view.getUint32(28, true); // Byte rate is at byte 28 (little-endian)
    if (byteRate <= 0) {
      return null;
    }

    // Total data size
    // Standard WAV has data chunk. Let's find 'data' Chunk ID.
    // In a standard 44-byte WAV, 'data' is at byte 36-39, and data size is at 40-43
    let dataSize = file.size - 44; // fallback estimation

    const isData = view.getUint32(36, false) === 0x64617461; // 'data'
    if (isData) {
      dataSize = view.getUint32(40, true);
    }

    const duration = dataSize / byteRate;
    if (duration > 0 && duration < 3600) {
      // sanity check
      return duration;
    }
    return null;
  } catch (err) {
    console.warn('Failed to parse WAV duration from header:', err);
    return null;
  }
};

/**
 * Converts an AudioBuffer to a WAV Blob.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = raw PCM
  const bitDepth = 16;

  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  const bufferArr = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(bufferArr);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + result.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * 2, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, result.length * 2, true);

  floatTo16BitPCM(view, 44, result);

  return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Extracts the audio track from a video File if it exists, converting it to a WAV File
 * and computing its waveform peaks.
 */
export const extractAudioTrack = async (
  videoFile: File,
): Promise<{ file: File; duration: number; peaks: number[] } | null> => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    const audioCtx = new AudioContextClass();
    let audioBuffer: AudioBuffer;
    try {
      const arrayBuffer = await videoFile.arrayBuffer();
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
      });
    } finally {
      audioCtx.close();
    }

    if (audioBuffer.numberOfChannels === 0 || audioBuffer.duration === 0) {
      return null;
    }

    // Convert audioBuffer to WAV
    const wavBlob = audioBufferToWav(audioBuffer);
    const wavFile = new File([wavBlob], 'original-audio.wav', { type: 'audio/wav' });

    // Generate peaks for waveform rendering
    const sampleCount = 80;
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / sampleCount);
    const peaks: number[] = [];

    for (let i = 0; i < sampleCount; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(max);
    }

    const maxPeak = Math.max(...peaks, 0.01);
    const normalizedPeaks = peaks.map((p) => Math.max(0.05, p / maxPeak));

    return {
      file: wavFile,
      duration: audioBuffer.duration,
      peaks: normalizedPeaks,
    };
  } catch (err) {
    console.warn('No audio track extracted or failed decoding:', err);
    return null;
  }
};
