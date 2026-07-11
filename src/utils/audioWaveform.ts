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
    const arrayBuffer = await file.arrayBuffer();
    
    // decodeAudioData might not return a promise in older browsers, so wrap it
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
    });
    
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
    return peaks.map(p => Math.max(0.05, p / maxPeak));
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
    if (duration > 0 && duration < 3600) { // sanity check
      return duration;
    }
    return null;
  } catch (err) {
    console.warn('Failed to parse WAV duration from header:', err);
    return null;
  }
};

