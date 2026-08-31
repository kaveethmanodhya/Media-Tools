export interface ExtractedFrame {
  id: string;
  number: number;
  timestamp: number;
  blob: Blob;
  size: number;
  previewUrl?: string;
  extension: string;
}

export type ResolutionMode = 'Original' | '1080p (FHD)' | '720p (HD)' | '480p';
export type OutputFormat = 'image/webp' | 'image/jpeg';

export async function getVideoMetadata(file: File): Promise<{ duration: number; videoWidth: number; videoHeight: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve({
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    };
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

export async function* extractFramesGenerator(
  file: File,
  stepSeconds: number,
  quality: number = 0.85,
  resolution: ResolutionMode = 'Original',
  format: OutputFormat = 'image/jpeg',
  startIndex: number = 0
): AsyncGenerator<ExtractedFrame, void, unknown> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }

  // Wait for metadata to know duration and dimensions
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
  });

  let MAX_WIDTH: number | null = null;
  switch (resolution) {
    case '1080p (FHD)': MAX_WIDTH = 1920; break;
    case '720p (HD)': MAX_WIDTH = 1280; break;
    case '480p': MAX_WIDTH = 854; break;
    case 'Original': default: MAX_WIDTH = null; break;
  }

  let canvasWidth = video.videoWidth;
  let canvasHeight = video.videoHeight;

  if (MAX_WIDTH && canvasWidth > MAX_WIDTH) {
    canvasHeight = Math.round((MAX_WIDTH / canvasWidth) * canvasHeight);
    canvasWidth = MAX_WIDTH;
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const duration = video.duration;
  let currentTime = startIndex * stepSeconds;
  let frameNumber = startIndex + 1;

  while (currentTime <= duration) {
    // Seek to the target time
    const seeked = new Promise((resolve, reject) => {
      video.onseeked = resolve;
      video.onerror = reject;
    });
    
    video.currentTime = currentTime;
    await seeked;

    // Draw frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to requested format Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });

    if (blob) {
      yield {
        id: crypto.randomUUID(),
        number: frameNumber,
        timestamp: currentTime,
        blob,
        size: blob.size,
        extension: format === 'image/jpeg' ? 'jpg' : 'webp',
      };
    }

    currentTime += stepSeconds;
    frameNumber++;
  }

  window.URL.revokeObjectURL(video.src);
}
