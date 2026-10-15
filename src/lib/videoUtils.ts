export interface ExtractedFrame {
  id: string;
  number: number;
  timestamp: number;
  blob: Blob;
  size: number;
  previewUrl?: string;
  extension: string;
  deleted?: boolean;
}

export interface ExtractionOptions {
  startTime: number;
  endTime: number;
  stepSeconds: number;
  aspectRatio: AspectRatio;
  quality: number; // 0–1
  maxWidth: number;
  enableDuplicateRemoval: boolean;
  duplicateThreshold: number; // fraction 0–1, e.g. 0.02 = 2%
  enableBgRemoval?: boolean;
  bgRemovalModel?: 'isnet' | 'isnet_fp16' | 'isnet_quint8';
  bgRemovalDevice?: 'gpu' | 'cpu';
  bgRefineEdges?: boolean;
}

export type AspectRatio = 'free' | '1:1' | '16:9' | '9:16';

export async function getVideoMetadata(
  file: File
): Promise<{ duration: number; videoWidth: number; videoHeight: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
    video.src = url;
  });
}

/**
 * Extract a single test frame at the given time and return its blob size.
 * Used to silently estimate output before bulk extraction.
 */
export async function estimateFrameSize(
  file: File,
  atTime: number = 0,
  options?: Partial<ExtractionOptions>
): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      URL.revokeObjectURL(url);
      resolve(0);
      return;
    }

    const quality = options?.quality ?? 0.75;
    const maxWidth = options?.maxWidth ?? 1280;
    const aspectRatio = options?.aspectRatio ?? 'free';

    video.onloadedmetadata = () => {
      const dims = computeCanvasDimensions(
        video.videoWidth,
        video.videoHeight,
        aspectRatio,
        maxWidth
      );
      canvas.width = dims.width;
      canvas.height = dims.height;

      video.onseeked = () => {
        ctx.drawImage(video, dims.sx, dims.sy, dims.sw, dims.sh, 0, 0, dims.width, dims.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob ? blob.size : 0);
          },
          'image/webp',
          quality
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };

      video.currentTime = atTime;
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

/**
 * Compute canvas draw dimensions based on aspect ratio preset.
 * Returns: { width, height } for canvas + {sx, sy, sw, sh} source crop on the video.
 */
export function computeCanvasDimensions(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: AspectRatio,
  maxWidth: number
): { width: number; height: number; sx: number; sy: number; sw: number; sh: number } {
  // First, determine the target aspect ratio
  let targetAR: number;

  switch (aspectRatio) {
    case '1:1':
      targetAR = 1;
      break;
    case '16:9':
      targetAR = 16 / 9;
      break;
    case '9:16':
      targetAR = 9 / 16;
      break;
    case 'free':
    default:
      targetAR = videoWidth / videoHeight;
      break;
  }

  // Source crop: center-crop the video to match targetAR
  const sourceAR = videoWidth / videoHeight;
  let sx = 0, sy = 0, sw = videoWidth, sh = videoHeight;

  if (Math.abs(sourceAR - targetAR) > 0.001) {
    if (sourceAR > targetAR) {
      // Video is wider than target → crop sides
      sh = videoHeight;
      sw = Math.round(videoHeight * targetAR);
      sx = Math.round((videoWidth - sw) / 2);
    } else {
      // Video is taller than target → crop top/bottom
      sw = videoWidth;
      sh = Math.round(videoWidth / targetAR);
      sy = Math.round((videoHeight - sh) / 2);
    }
  }

  // Scale down if needed
  let width = sw;
  let height = sh;
  if (width > maxWidth) {
    height = Math.round((maxWidth / width) * height);
    width = maxWidth;
  }

  return { width, height, sx, sy, sw, sh };
}

/**
 * Compare two ImageData buffers. Returns the fraction of pixels that differ
 * beyond a small per-channel tolerance.
 */
export function computeFrameDifference(
  a: ImageData,
  b: ImageData,
  channelTolerance: number = 10
): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const len = a.data.length;
  let diffCount = 0;

  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(a.data[i] - b.data[i]);
    const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
    const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (dr > channelTolerance || dg > channelTolerance || db > channelTolerance) {
      diffCount++;
    }
  }

  return diffCount / (len / 4);
}

export async function* extractFramesGenerator(
  file: File,
  options: ExtractionOptions,
  startIndex: number = 0
): AsyncGenerator<ExtractedFrame, void, unknown> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  const url = URL.createObjectURL(file);
  video.src = url;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error('Failed to get canvas 2d context');
  }

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
  });

  const dims = computeCanvasDimensions(
    video.videoWidth,
    video.videoHeight,
    options.aspectRatio,
    options.maxWidth
  );

  canvas.width = dims.width;
  canvas.height = dims.height;

  const clampedEnd = Math.min(options.endTime, video.duration);
  const clampedStart = Math.max(options.startTime, 0);

  let currentTime = clampedStart + startIndex * options.stepSeconds;
  let frameNumber = startIndex + 1;
  let prevImageData: ImageData | null = null;

  while (currentTime <= clampedEnd) {
    const seeked = new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Seek failed'));
    });

    video.currentTime = currentTime;
    await seeked;

    ctx.drawImage(video, dims.sx, dims.sy, dims.sw, dims.sh, 0, 0, dims.width, dims.height);

    // Duplicate removal
    if (options.enableDuplicateRemoval) {
      const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (prevImageData !== null) {
        const diff = computeFrameDifference(currentImageData, prevImageData);
        if (diff < options.duplicateThreshold) {
          currentTime += options.stepSeconds;
          await new Promise((r) => setTimeout(r, 0));
          continue;
        }
      }
      prevImageData = currentImageData;
    }

    let finalBlob: Blob | null = null;
    let extension = 'webp';

    if (options.enableBgRemoval) {
      try {
        const { removeImageBackground } = await import('@/lib/bgRemovalEngine');
        const bgRes = await removeImageBackground(canvas, {
          model: options.bgRemovalModel || 'isnet_quint8',
          device: options.bgRemovalDevice || 'gpu',
          format: 'image/png',
          refineEdges: options.bgRefineEdges ?? true,
        });
        finalBlob = bgRes.blob;
        extension = 'png';
      } catch (err) {
        console.warn('Background removal failed for frame, falling back to standard canvas frame:', err);
        finalBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/webp', options.quality);
        });
      }
    } else {
      finalBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', options.quality);
      });
    }

    if (finalBlob) {
      yield {
        id: crypto.randomUUID(),
        number: frameNumber,
        timestamp: currentTime,
        blob: finalBlob,
        size: finalBlob.size,
        extension,
      };
    }

    currentTime += options.stepSeconds;
    frameNumber++;

    // Yield to prevent UI freezing
    await new Promise((r) => setTimeout(r, 0));
  }

  URL.revokeObjectURL(url);
}
