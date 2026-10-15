/**
 * Advanced Background Removal Engine
 * Hardware-accelerated (WebGPU) with multi-precision neural models and edge refinement.
 */

export type BgRemovalModel = 'isnet' | 'isnet_fp16' | 'isnet_quint8';
export type BgRemovalDevice = 'gpu' | 'cpu';

export interface MattingRefinementOptions {
  featherRadius: number; // 0 to 5 px
  thresholdCutoff: number; // 0 to 50
  deFringe: boolean; // remove background color halos
}

export interface BgRemovalOptions {
  model?: BgRemovalModel;
  device?: BgRemovalDevice;
  format?: 'image/png' | 'image/webp';
  quality?: number; // 0 to 1
  maxDimension?: number; // 0 for original, or 1920, 1280, 800
  refineEdges?: boolean;
  refinement?: Partial<MattingRefinementOptions>;
  onProgress?: (progress: number, statusText: string) => void;
}

/**
 * Check whether WebGPU is supported and available in the user's browser.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as any;
  if (!nav.gpu || typeof nav.gpu.requestAdapter !== 'function') return false;
  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Scale an image or Blob down to maxDimension if needed to optimize inference speed.
 */
export async function preprocessImage(
  source: Blob | File | HTMLCanvasElement,
  maxDimension: number = 0
): Promise<{ source: Blob | File | HTMLCanvasElement; width: number; height: number }> {
  if (maxDimension <= 0) {
    if (source instanceof HTMLCanvasElement) {
      return { source, width: source.width, height: source.height };
    }
    const dims = await getImageDimensions(source);
    return { source, width: dims.width, height: dims.height };
  }

  // Check dimensions
  let srcWidth = 0;
  let srcHeight = 0;
  let imgBitmap: ImageBitmap | null = null;

  if (source instanceof HTMLCanvasElement) {
    srcWidth = source.width;
    srcHeight = source.height;
  } else {
    imgBitmap = await createImageBitmap(source);
    srcWidth = imgBitmap.width;
    srcHeight = imgBitmap.height;
  }

  if (Math.max(srcWidth, srcHeight) <= maxDimension) {
    if (imgBitmap) imgBitmap.close();
    return { source, width: srcWidth, height: srcHeight };
  }

  // Scale down maintaining aspect ratio
  const scale = maxDimension / Math.max(srcWidth, srcHeight);
  const targetWidth = Math.round(srcWidth * scale);
  const targetHeight = Math.round(srcHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    if (imgBitmap) imgBitmap.close();
    return { source, width: srcWidth, height: srcHeight };
  }

  if (source instanceof HTMLCanvasElement) {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  } else if (imgBitmap) {
    ctx.drawImage(imgBitmap, 0, 0, targetWidth, targetHeight);
    imgBitmap.close();
  }

  const scaledBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Resize failed'))), 'image/png');
  });

  return { source: scaledBlob, width: targetWidth, height: targetHeight };
}

/**
 * Inspect image dimensions from Blob or File.
 */
function getImageDimensions(blob: Blob | File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

/**
 * Post-processing edge refinement on ImageData:
 * 1. Alpha Thresholding (de-noise stray pixels)
 * 2. De-fringing (removes color halo around edge boundary)
 * 3. Alpha Feathering / Smoothing (anti-aliases stepped pixel edges)
 */
export function refineMatteImageData(
  imageData: ImageData,
  options: MattingRefinementOptions
): ImageData {
  const { featherRadius, thresholdCutoff, deFringe } = options;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const totalPixels = width * height;

  // 1. Thresholding: Clean up faint ghosting
  if (thresholdCutoff > 0) {
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i];
      if (a > 0 && a < thresholdCutoff) {
        data[i] = 0;
      } else if (a > 248) {
        data[i] = 255;
      }
    }
  }

  // 2. De-fringing: Fix color halo on semi-transparent silhouette borders
  if (deFringe) {
    const originalData = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = (rowOffset + x) * 4;
        const alpha = originalData[idx + 3];

        if (alpha >= 12 && alpha <= 230) {
          let sumR = 0, sumG = 0, sumB = 0, count = 0;

          // Sample 3x3 neighborhood for solid subject pixels
          for (let dy = -1; dy <= 1; dy++) {
            const nRow = (y + dy) * width;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = (nRow + (x + dx)) * 4;
              if (originalData[nIdx + 3] >= 220) {
                sumR += originalData[nIdx];
                sumG += originalData[nIdx + 1];
                sumB += originalData[nIdx + 2];
                count++;
              }
            }
          }

          if (count > 0) {
            const fgR = sumR / count;
            const fgG = sumG / count;
            const fgB = sumB / count;
            const blendRatio = (255 - alpha) / 255 * 0.85;
            data[idx] = Math.round(data[idx] * (1 - blendRatio) + fgR * blendRatio);
            data[idx + 1] = Math.round(data[idx + 1] * (1 - blendRatio) + fgG * blendRatio);
            data[idx + 2] = Math.round(data[idx + 2] * (1 - blendRatio) + fgB * blendRatio);
          }
        }
      }
    }
  }

  // 3. Feathering / Edge Anti-Aliasing
  if (featherRadius > 0) {
    const alphaCopy = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }

    const radius = Math.min(Math.max(1, Math.round(featherRadius)), 3);
    for (let y = radius; y < height - radius; y++) {
      const rowOffset = y * width;
      for (let x = radius; x < width - radius; x++) {
        const pIdx = rowOffset + x;
        const curA = alphaCopy[pIdx];

        // Only smooth border transition pixels
        if (curA > 0 && curA < 255) {
          let sumA = 0;
          let weightSum = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            const nRow = (y + dy) * width;
            for (let dx = -radius; dx <= radius; dx++) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > radius) continue;
              const weight = 1 / (1 + dist);
              sumA += alphaCopy[nRow + (x + dx)] * weight;
              weightSum += weight;
            }
          }
          data[pIdx * 4 + 3] = Math.round(sumA / weightSum);
        }
      }
    }
  }

  return imageData;
}

/**
 * Apply canvas post-processing on a transparent image Blob.
 */
export async function applyMatteRefinement(
  transparentBlob: Blob,
  refinement: MattingRefinementOptions,
  format: 'image/png' | 'image/webp' = 'image/png',
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(transparentBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(transparentBlob);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      refineMatteImageData(imgData, refinement);
      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(transparentBlob);
        },
        format,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for refinement'));
    };
    img.src = url;
  });
}

/**
 * Remove background with GPU acceleration, precision models, and edge refinement.
 */
export async function removeImageBackground(
  input: Blob | File | HTMLCanvasElement,
  options: BgRemovalOptions = {}
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  deviceUsed: string;
  timeMs: number;
}> {
  const startTime = performance.now();
  const {
    model = 'isnet', // default to Ultra Quality (Full FP32 IS-Net)
    device = 'gpu',  // auto WebGPU hardware acceleration
    format = 'image/png',
    quality = 0.95,
    maxDimension = 0,
    refineEdges = true,
    refinement = {
      featherRadius: 1,
      thresholdCutoff: 12,
      deFringe: true,
    },
    onProgress,
  } = options;

  onProgress?.(5, 'Preparing image and hardware acceleration…');

  // Pre-process scaling if maxDimension is configured
  const preprocessed = await preprocessImage(input, maxDimension);
  const inputSource = preprocessed.source;

  onProgress?.(15, 'Loading AI neural network model…');

  // Dynamically import @imgly/background-removal to keep SSR clean
  const { removeBackground } = await import('@imgly/background-removal');

  // Check WebGPU availability
  const hasWebGPU = await checkWebGPUSupport();
  const effectiveDevice: BgRemovalDevice = (device === 'gpu' && hasWebGPU) ? 'gpu' : 'cpu';

  onProgress?.(30, effectiveDevice === 'gpu' ? 'Running on GPU (WebGPU accelerated)…' : 'Running on CPU (Multi-threaded)…');

  const rawResultBlob = await removeBackground(inputSource as any, {
    device: effectiveDevice,
    model: model,
    proxyToWorker: effectiveDevice === 'gpu',
    output: {
      format: 'image/png', // produce lossless PNG first for matting
      quality: 1,
    },
    progress: (key: string, current: number, total: number) => {
      if (key === 'compute:inference' && total > 0) {
        const pct = Math.min(90, 30 + Math.round((current / total) * 55));
        onProgress?.(pct, `AI Segmenting: ${Math.round((current / total) * 100)}%`);
      }
    },
  });

  onProgress?.(90, 'Refining edge contours and alpha matte…');

  let finalBlob = rawResultBlob;
  if (refineEdges) {
    const fullRefinement: MattingRefinementOptions = {
      featherRadius: refinement.featherRadius ?? 1,
      thresholdCutoff: refinement.thresholdCutoff ?? 12,
      deFringe: refinement.deFringe ?? true,
    };
    finalBlob = await applyMatteRefinement(rawResultBlob, fullRefinement, format, quality);
  } else if (format === 'image/webp') {
    // If user requested WebP without refinement, convert PNG blob to WebP
    finalBlob = await convertBlobFormat(rawResultBlob, 'image/webp', quality);
  }

  const duration = Math.round(performance.now() - startTime);
  onProgress?.(100, `Done in ${(duration / 1000).toFixed(1)}s`);

  return {
    blob: finalBlob,
    width: preprocessed.width,
    height: preprocessed.height,
    deviceUsed: effectiveDevice === 'gpu' ? 'WebGPU (Hardware Accelerated)' : 'CPU (WebAssembly)',
    timeMs: duration,
  };
}

/**
 * Helper to convert Blob format via canvas
 */
async function convertBlobFormat(blob: Blob, targetFormat: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(blob);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => (b ? resolve(b) : resolve(blob)),
        targetFormat,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Conversion load failed'));
    };
    img.src = url;
  });
}
