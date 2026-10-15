'use client';

import React, { useState, useRef, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import {
  ImageIcon,
  UploadCloud,
  Download,
  X,
  RefreshCw,
  Play,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

type OutputFormat = 'image/webp' | 'image/png' | 'image/jpeg';

interface ConvertedImage {
  id: string;
  name: string;
  originalSize: number;
  originalUrl: string;
  originalWidth?: number;
  originalHeight?: number;
  outputBlob: Blob | null;
  outputUrl: string | null;
  outputSize: number;
  outputWidth?: number;
  outputHeight?: number;
  status: 'pending' | 'converting' | 'done' | 'error';
  progress?: number;
  errorMessage?: string;
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  'image/webp': 'WebP',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
};

const FORMAT_EXTS: Record<OutputFormat, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * Extracts width and height from an image Blob/File without manual DOM leaks.
 */
async function getImageDimensions(fileOrBlob: Blob): Promise<{ width: number; height: number }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(fileOrBlob);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();
      return { width, height };
    }
  } catch {
    // Fall back to HTML Image element if createImageBitmap is unavailable
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

/**
 * Converts and compresses an image file using browser-image-compression in a Web Worker.
 * Replaces manual canvas drawing to guarantee high visual clarity and predictable small file sizes.
 */
async function convertImage(
  file: File,
  format: OutputFormat,
  quality: number,
  maxWidthOrHeight: number,
  maxSizeMB: number,
  onProgress?: (progress: number) => void
): Promise<{
  blob: Blob;
  url: string;
  origW: number;
  origH: number;
  outW: number;
  outH: number;
}> {
  // 1. Inspect original image dimensions
  const origDims = await getImageDimensions(file);

  // 2. Configure advanced compression options
  const options = {
    maxSizeMB: maxSizeMB > 0 ? maxSizeMB : 0.8,
    maxWidthOrHeight: maxWidthOrHeight > 0 ? maxWidthOrHeight : undefined,
    useWebWorker: true,
    fileType: format,
    alwaysKeepResolution: false,
    initialQuality:
      format === 'image/png'
        ? undefined
        : Math.min(Math.max(quality || 0.75, 0.05), 0.95),
    onProgress,
  };

  // 3. Run client-side multi-pass compression in Web Worker
  const compressedFile = await imageCompression(file, options);

  // 4. Inspect resulting compressed dimensions
  const outDims = await getImageDimensions(compressedFile);

  return {
    blob: compressedFile,
    url: URL.createObjectURL(compressedFile),
    origW: origDims.width,
    origH: origDims.height,
    outW: outDims.width || origDims.width,
    outH: outDims.height || origDims.height,
  };
}

export function BulkImageConverter() {
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<OutputFormat>('image/webp');

  // Strict compression options
  // Default maxSizeMB: 0.8 (~800KB)
  const [maxSizeMB, setMaxSizeMB] = useState<number>(0.8);
  // Default maxWidthOrHeight: 1920px
  const [maxWidthOrHeight, setMaxWidthOrHeight] = useState<number>(1920);
  // Default initialQuality: 0.75 (75%)
  const [quality, setQuality] = useState<number>(0.75);

  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'].includes(f.type)
    );
    if (valid.length === 0) return;

    const newImages: ConvertedImage[] = valid.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      originalSize: f.size,
      originalUrl: URL.createObjectURL(f),
      outputBlob: null,
      outputUrl: null,
      outputSize: 0,
      status: 'pending',
    }));

    valid.forEach((f, i) => fileMap.set(newImages[i].id, f));
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((x) => x.id === id);
      if (img) {
        URL.revokeObjectURL(img.originalUrl);
        if (img.outputUrl) URL.revokeObjectURL(img.outputUrl);
      }
      return prev.filter((x) => x.id !== id);
    });
    fileMap.delete(id);
  };

  const convertAll = async () => {
    const pending = images.filter((img) => img.status === 'pending');
    if (pending.length === 0) return;
    setIsConverting(true);

    for (const img of pending) {
      const file = fileMap.get(img.id);
      if (!file) continue;

      setImages((prev) =>
        prev.map((x) =>
          x.id === img.id ? { ...x, status: 'converting', progress: 5 } : x
        )
      );

      try {
        const { blob, url, origW, origH, outW, outH } = await convertImage(
          file,
          format,
          quality,
          maxWidthOrHeight,
          maxSizeMB,
          (progressPercent) => {
            setImages((prev) =>
              prev.map((x) =>
                x.id === img.id
                  ? { ...x, progress: Math.min(Math.round(progressPercent), 99) }
                  : x
              )
            );
          }
        );

        setImages((prev) =>
          prev.map((x) =>
            x.id === img.id
              ? {
                  ...x,
                  status: 'done',
                  progress: 100,
                  outputBlob: blob,
                  outputUrl: url,
                  outputSize: blob.size,
                  originalWidth: origW,
                  originalHeight: origH,
                  outputWidth: outW,
                  outputHeight: outH,
                }
              : x
          )
        );
      } catch (err: unknown) {
        console.error('Advanced compression failed for', img.name, err);
        const errMsg = err instanceof Error ? err.message : 'Compression failed';
        setImages((prev) =>
          prev.map((x) =>
            x.id === img.id ? { ...x, status: 'error', errorMessage: errMsg } : x
          )
        );
      }

      // Yield thread
      await new Promise((r) => setTimeout(r, 0));
    }

    setIsConverting(false);
  };

  const downloadAll = async () => {
    const done = images.filter((img) => img.status === 'done' && img.outputBlob);
    if (done.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder('converted') || zip;

    done.forEach((img) => {
      const base = img.name.replace(/\.[^/.]+$/, '');
      folder.file(`${base}.${FORMAT_EXTS[format]}`, img.outputBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted_images.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadSingle = (img: ConvertedImage) => {
    if (!img.outputUrl) return;
    const base = img.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = img.outputUrl;
    a.download = `${base}.${FORMAT_EXTS[format]}`;
    a.click();
  };

  const reset = () => {
    images.forEach((img) => {
      URL.revokeObjectURL(img.originalUrl);
      if (img.outputUrl) URL.revokeObjectURL(img.outputUrl);
    });
    fileMap.clear();
    setImages([]);
  };

  const doneImages = images.filter((x) => x.status === 'done');
  const doneCount = doneImages.length;
  const totalOriginalBytes = doneImages.reduce((acc, x) => acc + x.originalSize, 0);
  const totalOutputBytes = doneImages.reduce((acc, x) => acc + x.outputSize, 0);
  const totalSavedBytes = totalOriginalBytes - totalOutputBytes;
  const totalSavingsPercent =
    totalOriginalBytes > 0
      ? Math.round((totalSavedBytes / totalOriginalBytes) * 100)
      : 0;

  const anyIncreased = doneImages.some((x) => x.outputSize > x.originalSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overall Stats */}
      {images.length > 0 && (
        <div className="stat-row fade-up">
          <div className="stat-tile">
            <div className="stat-value">{images.length}</div>
            <div className="stat-label">Queued</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{doneCount}</div>
            <div className="stat-label">Processed</div>
          </div>
          <div className="stat-tile">
            <div
              className="stat-value mono"
              style={{
                fontSize: '15px',
                color:
                  totalSavedBytes > 0
                    ? 'var(--mint)'
                    : totalSavedBytes < 0
                    ? '#f87171'
                    : 'var(--text-primary)',
              }}
            >
              {doneCount === 0
                ? '—'
                : totalSavedBytes > 0
                ? `-${formatFileSize(totalSavedBytes)} (${totalSavingsPercent}%)`
                : totalSavedBytes < 0
                ? `+${formatFileSize(Math.abs(totalSavedBytes))} (+${Math.abs(totalSavingsPercent)}%)`
                : '0 KB (0%)'}
            </div>
            <div className="stat-label">
              {totalSavedBytes >= 0 ? 'Total Saved' : 'Size Increased'}
            </div>
          </div>
        </div>
      )}

      {/* Warning hint only if an image was already hyper-compressed source */}
      {anyIncreased && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#f87171',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 600 }}>Some converted images increased in file size.</span>{' '}
            The source image was already heavily compressed. Lower the Target Max Size (e.g. to 0.3–0.5 MB) or reduce Max Dimension to enforce reduction.
          </div>
        </div>
      )}

      <div className="tool-grid">
        {/* Left Settings Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Upload Dropzone */}
          <div
            className={`upload-zone${isDragging ? ' dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <UploadCloud size={22} />
            </div>
            <p
              style={{
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}
            >
              Drop images here
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              PNG · JPEG · WebP · GIF · BMP
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
              aria-label="Upload images for conversion"
            />
          </div>

          {/* Advanced Compression Engine Settings */}
          <div className="card card-sm">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Sliders size={15} style={{ color: 'var(--mint)' }} />
                <span>Compression Engine</span>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(255, 90, 9, 0.12)',
                  color: 'var(--mint)',
                  fontWeight: 600,
                }}
              >
                <Cpu size={11} /> Web Worker
              </span>
            </div>

            {/* Target Format Tabs */}
            <label style={{ marginBottom: '8px' }}>Target Format</label>
            <div className="tabs" style={{ marginBottom: '16px' }}>
              {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`tab-btn${format === f ? ' active' : ''}`}
                  onClick={() => setFormat(f)}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>

            {/* Target Max Size (MB) - Key parameter for browser-image-compression */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span>Max File Size (maxSizeMB)</span>
                  <Sparkles size={12} style={{ color: 'var(--mint)' }} />
                </span>
                <span className="mono" style={{ color: 'var(--mint)', fontWeight: 600, fontSize: '12px' }}>
                  {maxSizeMB >= 1 ? `${maxSizeMB.toFixed(2)} MB` : `${Math.round(maxSizeMB * 1024)} KB`}
                </span>
              </label>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', marginTop: '6px' }}>
                {[
                  { label: '300KB', val: 0.3 },
                  { label: '500KB', val: 0.5 },
                  { label: '800KB', val: 0.8 },
                  { label: '1MB', val: 1.0 },
                  { label: '2MB', val: 2.0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`ratio-btn${maxSizeMB === preset.val ? ' active' : ''}`}
                    style={{ flex: 1, padding: '5px 2px', fontSize: '10.5px', textAlign: 'center' }}
                    onClick={() => setMaxSizeMB(preset.val)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min={0.1}
                max={3.0}
                step={0.05}
                value={maxSizeMB}
                onChange={(e) => setMaxSizeMB(parseFloat(e.target.value) || 0.8)}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                }}
              >
                <span>0.1 MB (~100KB)</span>
                <span style={{ color: 'var(--mint)' }}>0.8 MB (Default)</span>
                <span>3.0 MB</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Multi-pass worker iteratively optimizes quality to strictly fit within this size budget.
              </p>
            </div>

            {/* Max Dimension Downscaling (maxWidthOrHeight) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Max Dimension (Width / Height)</span>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {maxWidthOrHeight > 0 ? `${maxWidthOrHeight}px` : 'Original'}
                </span>
              </label>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', marginTop: '6px' }}>
                {[
                  { label: '1920 (FHD)', val: 1920 },
                  { label: '1280 (HD)', val: 1280 },
                  { label: '800 (Web)', val: 800 },
                  { label: 'Original', val: 0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`ratio-btn${maxWidthOrHeight === preset.val ? ' active' : ''}`}
                    style={{ flex: 1, padding: '5px 4px', fontSize: '11px', textAlign: 'center' }}
                    onClick={() => setMaxWidthOrHeight(preset.val)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={maxWidthOrHeight || ''}
                min={0}
                placeholder="1920 (Default px)"
                onChange={(e) => setMaxWidthOrHeight(parseInt(e.target.value) || 0)}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Intelligently scales down oversized images to prevent bloated pixel encodes.
              </p>
            </div>

            {/* Initial Quality Slider */}
            {format !== 'image/png' && (
              <div style={{ marginBottom: '6px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Initial Quality Level</span>
                  <span style={{ color: 'var(--mint)' }} className="mono">
                    {Math.round(quality * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.05}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  <span>10% (Aggressive)</span>
                  <span style={{ color: 'var(--mint)' }}>75% (Recommended)</span>
                  <span>95% (Max)</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn btn-primary"
              disabled={images.length === 0 || isConverting}
              onClick={convertAll}
              id="convert-all-btn"
            >
              {isConverting ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
              {isConverting ? 'Compressing via Worker…' : `Convert All (${images.length})`}
            </button>
            {doneCount > 0 && (
              <button className="btn btn-secondary" onClick={downloadAll} id="download-all-btn">
                <Download size={15} /> Download All as ZIP ({doneCount})
              </button>
            )}
            {images.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                <X size={13} /> Clear Queue
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Image Queue & Before / After Compression Feedback */}
        <div className="card" style={{ minHeight: '360px', overflowY: 'auto' }}>
          {images.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                gap: '12px',
                height: '100%',
                minHeight: '300px',
              }}
            >
              <ImageIcon size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: '14px' }}>Add or drop images to start batch compression</p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '320px', textAlign: 'center' }}>
                Advanced multi-pass compression powered by Web Workers. Targets ≤ {maxSizeMB >= 1 ? `${maxSizeMB}MB` : `${Math.round(maxSizeMB * 1024)}KB`} with max {maxWidthOrHeight || 'original'}px dimensions.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Conversion Queue ({images.length})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {doneCount}/{images.length} completed
                </span>
              </div>

              {images.map((img) => {
                const isDone = img.status === 'done';
                const isLarger = isDone && img.outputSize > img.originalSize;
                const isSmaller = isDone && img.outputSize < img.originalSize;
                const percentSaved =
                  isDone && img.originalSize > 0
                    ? Math.round(((img.originalSize - img.outputSize) / img.originalSize) * 100)
                    : 0;
                const percentIncreased =
                  isDone && img.originalSize > 0
                    ? Math.round(((img.outputSize - img.originalSize) / img.originalSize) * 100)
                    : 0;

                const withinTarget =
                  isDone && img.outputSize <= maxSizeMB * 1024 * 1024;

                return (
                  <div
                    key={img.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      background: 'rgba(20, 20, 20, 0.6)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      border: `1px solid ${
                        isDone
                          ? isLarger
                            ? 'rgba(239, 68, 68, 0.4)'
                            : 'rgba(52, 211, 153, 0.35)'
                          : img.status === 'error'
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'var(--border-charcoal)'
                      }`,
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Image Thumbnail Preview */}
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '1px solid var(--border-charcoal)',
                          background: '#141414',
                        }}
                      >
                        <img
                          src={img.outputUrl || img.originalUrl}
                          alt={img.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>

                      {/* Image Info & Detailed Before/After Feedback */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            marginBottom: '3px',
                          }}
                        >
                          <p
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                            className="truncate"
                          >
                            {img.name}
                          </p>

                          {isDone && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isSmaller
                                  ? 'rgba(52, 211, 153, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                                color: isSmaller ? 'var(--mint)' : '#f87171',
                                flexShrink: 0,
                              }}
                            >
                              {isSmaller ? `-${percentSaved}% Saved` : `+${percentIncreased}%`}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          <span>
                            <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                              Before:
                            </strong>{' '}
                            {formatFileSize(img.originalSize)}
                          </span>

                          {isDone && (
                            <>
                              <span style={{ color: 'var(--text-dim)' }}>→</span>
                              <span>
                                <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                  After:
                                </strong>{' '}
                                <span
                                  style={{
                                    color: isSmaller
                                      ? 'var(--mint)'
                                      : isLarger
                                      ? '#f87171'
                                      : 'var(--text-primary)',
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatFileSize(img.outputSize)}
                                </span>
                              </span>

                              {withinTarget && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    color: 'var(--mint)',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                  }}
                                  title="Target size budget met"
                                >
                                  <CheckCircle2 size={11} /> Target met
                                </span>
                              )}

                              {img.outputWidth && img.outputHeight && (
                                <span
                                  style={{
                                    color: 'var(--text-dim)',
                                    marginLeft: 'auto',
                                    fontSize: '10.5px',
                                  }}
                                >
                                  {img.originalWidth ? `${img.originalWidth}×${img.originalHeight} → ` : ''}
                                  {img.outputWidth}×{img.outputHeight}px
                                </span>
                              )}
                            </>
                          )}

                          {img.status === 'converting' && (
                            <span
                              style={{
                                color: '#fbbf24',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span>Compressing in Worker… {img.progress ? `${img.progress}%` : ''}</span>
                            </span>
                          )}
                          {img.status === 'error' && (
                            <span style={{ color: '#f87171' }}>
                              Failed: {img.errorMessage || 'Error during compression'}
                            </span>
                          )}
                        </div>

                        {/* Visual Web Worker Progress Bar */}
                        {img.status === 'converting' && (
                          <div
                            style={{
                              marginTop: '6px',
                              width: '100%',
                              height: '3px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${img.progress || 30}%`,
                                height: '100%',
                                background: 'var(--mint)',
                                transition: 'width 0.2s ease',
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Item Actions */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {isDone && (
                          <button
                            className="btn btn-icon btn-secondary"
                            onClick={() => downloadSingle(img)}
                            title="Download Converted File"
                            aria-label={`Download ${img.name}`}
                          >
                            <Download size={14} />
                          </button>
                        )}
                        {img.status === 'converting' && (
                          <div
                            className="btn btn-icon"
                            style={{ cursor: 'default', background: 'none' }}
                          >
                            <RefreshCw size={14} className="spin" style={{ color: '#fbbf24' }} />
                          </div>
                        )}
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => removeImage(img.id)}
                          title="Remove from queue"
                          aria-label={`Remove ${img.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Notice if image increased */}
                    {isLarger && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#f87171',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                        <span>
                          File size increased (+{percentIncreased}%). The source was already smaller than the target budget. Reduce target to 0.3MB or adjust dimensions.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Module-level cache to associate File objects with ConvertedImage IDs
const fileMap = new Map<string, File>();
