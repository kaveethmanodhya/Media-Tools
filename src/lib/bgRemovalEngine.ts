/**
 * Advanced Background Removal Engine
 * Hardware-accelerated (WebGPU) with multi-precision neural models and edge refinement.
 */

export type BgRemovalModel = 'isnet' | 'isnet_fp16' | 'isnet_quint8';
export type BgRemovalDevice = 'gpu' | 'cpu';

export interface MattingRefinementOptions {
  featherRadius: number; // 0 to 5 px (edge smoothing)
  thresholdCutoff: number; // 0 to 120 (background alpha cutoff threshold)
  deFringe: boolean; // remove background color halos
  edgeChoke?: number; // 0 to 3 px (erodes stubborn 1-2px background contour fringe)
  contrastBoost?: number; // 1 to 2.2 (sharpens alpha boundary to eliminate hazy background)
  removeStrayIslands?: boolean; // cleans isolated floating background noise blobs
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
  const {
    featherRadius = 0.8,
    thresholdCutoff = 35,
    deFringe = true,
    edgeChoke = 1,
    contrastBoost = 1.35,
    removeStrayIslands = true
  } = options;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const totalPixels = width * height;

  // 1. Adaptive Sigmoid / Contrast Thresholding
  // Purges faint shadows, floor reflections, wall noise, and semi-transparent halos
  const cutoff = Math.max(0, Math.min(240, thresholdCutoff));
  const boost = contrastBoost || 1.4;

  if (cutoff > 0) {
    const range = 255 - cutoff;
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i];
      if (a <= cutoff) {
        data[i] = 0;
      } else {
        // Smoothly scale remaining opacity from 0 to 255 with contrast curve
        const norm = (a - cutoff) / range;
        data[i] = Math.round(Math.pow(norm, boost) * 255);
      }
    }
  }

  // 2. Edge Choke (Morphological erosion of stubborn 1-5px background border fringe)
  const choke = Math.min(5, Math.max(0, Math.round(edgeChoke)));
  if (choke > 0) {
    const alphaCopy = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }
    for (let y = choke; y < height - choke; y++) {
      const rowOffset = y * width;
      for (let x = choke; x < width - choke; x++) {
        const pIdx = rowOffset + x;
        if (alphaCopy[pIdx] > 0) {
          let minA = alphaCopy[pIdx];
          for (let dy = -choke; dy <= choke; dy++) {
            const nRow = (y + dy) * width;
            for (let dx = -choke; dx <= choke; dx++) {
              if (dx * dx + dy * dy <= choke * choke) {
                const neighborA = alphaCopy[nRow + (x + dx)];
                if (neighborA < minA) minA = neighborA;
              }
            }
          }
          data[pIdx * 4 + 3] = minA;
        }
      }
    }
  }

  // 3. Remove small stray boundary noise and floating background crumbs
  if (removeStrayIslands) {
    const borderX = Math.round(width * 0.05);
    const borderY = Math.round(height * 0.05);
    for (let y = 0; y < height; y++) {
      const isBorderY = y < borderY || y > height - borderY;
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const isBorderX = x < borderX || x > width - borderX;
        const pIdx = (rowOffset + x) * 4;
        if (data[pIdx + 3] > 0 && data[pIdx + 3] < 210 && (isBorderX || isBorderY)) {
          data[pIdx + 3] = 0;
        }
      }
    }
  }

  // 4. De-fringing: Fix color halo on semi-transparent silhouette borders
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
              if (originalData[nIdx + 3] >= 210) {
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
            const blendRatio = ((255 - alpha) / 255) * 0.9;
            data[idx] = Math.round(data[idx] * (1 - blendRatio) + fgR * blendRatio);
            data[idx + 1] = Math.round(data[idx + 1] * (1 - blendRatio) + fgG * blendRatio);
            data[idx + 2] = Math.round(data[idx + 2] * (1 - blendRatio) + fgB * blendRatio);
          }
        }
      }
    }
  }

  // 5. Feathering / Edge Anti-Aliasing (applied softly to smooth real boundaries)
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
 * Magic Wand Color Key: Purge matching background color starting from target coordinates or across the image.
 */
export function purgeColorFromImageData(
  imageData: ImageData,
  targetX: number,
  targetY: number,
  tolerance: number = 32,
  contiguous: boolean = true
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const totalPixels = width * height;

  const startX = Math.max(0, Math.min(width - 1, Math.round(targetX)));
  const startY = Math.max(0, Math.min(height - 1, Math.round(targetY)));
  const targetIdx = (startY * width + startX) * 4;

  const targetR = data[targetIdx];
  const targetG = data[targetIdx + 1];
  const targetB = data[targetIdx + 2];
  const tolSq = tolerance * tolerance * 3;

  if (contiguous) {
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const startIdx = startY * width + startX;
    queue[tail++] = startIdx;
    visited[startIdx] = 1;

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % width;
      const pIdx = curr * 4;

      data[pIdx + 3] = 0; // Turn alpha transparent

      const neighbors = [
        cx > 0 ? curr - 1 : -1,
        cx < width - 1 ? curr + 1 : -1,
        curr >= width ? curr - width : -1,
        curr + width < totalPixels ? curr + width : -1,
      ];

      for (let n of neighbors) {
        if (n >= 0 && !visited[n]) {
          visited[n] = 1;
          const nIdx = n * 4;
          if (data[nIdx + 3] > 0) {
            const dr = data[nIdx] - targetR;
            const dg = data[nIdx + 1] - targetG;
            const db = data[nIdx + 2] - targetB;
            if (dr * dr + dg * dg + db * db <= tolSq) {
              queue[tail++] = n;
            }
          }
        }
      }
    }
  } else {
    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4;
      if (data[pIdx + 3] > 0) {
        const dr = data[pIdx] - targetR;
        const dg = data[pIdx + 1] - targetG;
        const db = data[pIdx + 2] - targetB;
        if (dr * dr + dg * dg + db * db <= tolSq) {
          data[pIdx + 3] = 0;
        }
      }
    }
  }

  return imageData;
}

/**
 * Flood-purge residual background touching the four corners and perimeter of the image.
 */
export function purgeCornersFromImageData(
  imageData: ImageData,
  tolerance: number = 40
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
    { x: Math.floor(width / 2), y: 0 },
  ];

  for (const corner of corners) {
    purgeColorFromImageData(imageData, corner.x, corner.y, tolerance, true);
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
  rawBlob: Blob;
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
      featherRadius: 0.8,
      thresholdCutoff: 45,
      deFringe: true,
      edgeChoke: 1.0,
      contrastBoost: 1.4,
      removeStrayIslands: true,
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

  const publicPath = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
  let rawResultBlob: Blob;

  const runInference = async (targetDevice: BgRemovalDevice) => {
    return await removeBackground(inputSource as any, {
      publicPath,
      device: targetDevice,
      model,
      proxyToWorker: false,
      output: {
        format: 'image/png',
        quality: 1,
      },
      progress: (key: string, current: number, total: number) => {
        if (key === 'compute:inference' && total > 0) {
          const pct = Math.min(90, 30 + Math.round((current / total) * 55));
          onProgress?.(pct, `AI Segmenting: ${Math.round((current / total) * 100)}%`);
        }
      },
    });
  };

  try {
    rawResultBlob = await runInference(effectiveDevice);
  } catch (err) {
    if (effectiveDevice === 'gpu') {
      onProgress?.(25, 'WebGPU unavailable on this system, running with CPU fallback…');
      rawResultBlob = await runInference('cpu');
    } else {
      throw err;
    }
  }

  onProgress?.(90, 'Refining edge contours and alpha matte…');

  let finalBlob = rawResultBlob;
  if (refineEdges) {
    const fullRefinement: MattingRefinementOptions = {
      featherRadius: refinement.featherRadius ?? 0.8,
      thresholdCutoff: refinement.thresholdCutoff ?? 45,
      deFringe: refinement.deFringe ?? true,
      edgeChoke: refinement.edgeChoke ?? 1.0,
      contrastBoost: refinement.contrastBoost ?? 1.4,
      removeStrayIslands: refinement.removeStrayIslands ?? true,
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
    rawBlob: rawResultBlob,
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
