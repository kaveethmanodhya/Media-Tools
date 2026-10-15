'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sliders, UploadCloud, Download, X, RefreshCw } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

type FilterName = 'none' | 'grayscale' | 'invert' | 'high-contrast' | 'sepia' | 'warm' | 'cool';

interface FilterDef {
  name: FilterName;
  label: string;
  description: string;
}

const FILTERS: FilterDef[] = [
  { name: 'none', label: 'Original', description: 'No filter applied' },
  { name: 'grayscale', label: 'Grayscale', description: 'Convert to black & white using luminance' },
  { name: 'invert', label: 'Invert', description: 'Invert all channel values (255 - value)' },
  { name: 'high-contrast', label: 'High Contrast', description: 'Push pixels towards black or white' },
  { name: 'sepia', label: 'Sepia', description: 'Warm vintage brown tone' },
  { name: 'warm', label: 'Warm', description: 'Boost reds and reduce blues' },
  { name: 'cool', label: 'Cool', description: 'Boost blues and reduce reds' },
];

// Pure pixel manipulation functions
function applyFilter(data: Uint8ClampedArray, filter: FilterName, intensity: number) {
  const len = data.length;
  const t = intensity; // 0-1

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let nr = r, ng = g, nb = b;

    switch (filter) {
      case 'grayscale': {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        nr = r + (lum - r) * t;
        ng = g + (lum - g) * t;
        nb = b + (lum - b) * t;
        break;
      }
      case 'invert': {
        nr = r + (255 - r - r) * t;
        ng = g + (255 - g - g) * t;
        nb = b + (255 - b - b) * t;
        break;
      }
      case 'high-contrast': {
        const threshold = 128;
        const cr = r < threshold ? Math.max(0, r - 80 * t) : Math.min(255, r + 80 * t);
        const cg = g < threshold ? Math.max(0, g - 80 * t) : Math.min(255, g + 80 * t);
        const cb = b < threshold ? Math.max(0, b - 80 * t) : Math.min(255, b + 80 * t);
        nr = r + (cr - r) * t;
        ng = g + (cg - g) * t;
        nb = b + (cb - b) * t;
        break;
      }
      case 'sepia': {
        const sr = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        const sg = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        const sb = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        nr = r + (sr - r) * t;
        ng = g + (sg - g) * t;
        nb = b + (sb - b) * t;
        break;
      }
      case 'warm': {
        nr = Math.min(255, r + 30 * t);
        ng = g + (g * 0.05) * t;
        nb = Math.max(0, b - 25 * t);
        break;
      }
      case 'cool': {
        nr = Math.max(0, r - 25 * t);
        ng = g + (g * 0.02) * t;
        nb = Math.min(255, b + 30 * t);
        break;
      }
      default:
        break;
    }

    data[i] = Math.round(nr);
    data[i + 1] = Math.round(ng);
    data[i + 2] = Math.round(nb);
    // alpha unchanged
  }
}

export function CanvasColorFilters() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterName>('none');
  const [intensity, setIntensity] = useState(1);
  const [isApplying, setIsApplying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalDataRef = useRef<ImageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImageToCanvas = useCallback((imgFile: File) => {
    const url = URL.createObjectURL(imgFile);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let w = img.naturalWidth;
      let h = img.naturalHeight;
      // Scale down if needed
      if (w > 1600) { h = Math.round((1600 / w) * h); w = 1600; }
      if (h > 1200) { w = Math.round((1200 / h) * w); h = 1200; }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);

      // Store original pixel data
      originalDataRef.current = ctx.getImageData(0, 0, w, h);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, []);

  const handleFile = useCallback((f: File) => {
    const valid = ['image/jpeg', 'image/png', 'image/webp'];
    if (!valid.includes(f.type)) {
      alert('Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    setFile(f);
    setActiveFilter('none');
    setIntensity(1);
    loadImageToCanvas(f);
  }, [loadImageToCanvas]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  // Reapply filter whenever filter or intensity changes
  useEffect(() => {
    if (!originalDataRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    if (canvas.width === 0 || canvas.height === 0) return;

    setIsApplying(true);

    // Use a short timeout to allow React to render loading state
    const timer = setTimeout(() => {
      const orig = originalDataRef.current!;
      const newData = new ImageData(new Uint8ClampedArray(orig.data), orig.width, orig.height);

      if (activeFilter !== 'none') {
        applyFilter(newData.data, activeFilter, intensity);
      }

      ctx.putImageData(newData, 0, 0);
      setIsApplying(false);
    }, 10);

    return () => clearTimeout(timer);
  }, [activeFilter, intensity]);

  const downloadResult = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) return;

    const base = file.name.replace(/\.[^/.]+$/, '');
    const filter = activeFilter !== 'none' ? `_${activeFilter}` : '';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}${filter}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setFile(null);
    setActiveFilter('none');
    setIntensity(1);
    originalDataRef.current = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="tool-grid">
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Upload */}
          <div
            className={`upload-zone${isDragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div style={{ textAlign: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
                <div className="upload-icon" style={{ margin: '0 auto 12px' }}>
                  <Sliders size={22} />
                </div>
                <p style={{ color: 'var(--mint)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }} className="truncate">
                  {file.name}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
                  {formatFileSize(file.size)}
                </p>
                <button className="btn btn-danger btn-sm" onClick={reset} style={{ margin: '0 auto', display: 'flex' }}>
                  <X size={13} /> Remove
                </button>
              </div>
            ) : (
              <>
                <div className="upload-icon"><UploadCloud size={22} /></div>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Drop image here
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PNG · JPEG · WebP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  aria-label="Upload image for color filtering"
                />
              </>
            )}
          </div>

          {/* Filter list */}
          <div className="card card-sm">
            <label style={{ marginBottom: '12px' }}>Select Filter</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {FILTERS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setActiveFilter(f.name)}
                  disabled={!file || isApplying}
                  style={{
                    display: 'flex', alignItems: 'flex-start', flexDirection: 'column',
                    padding: '10px 12px', borderRadius: '9px', border: '1px solid',
                    borderColor: activeFilter === f.name ? 'var(--mint)' : 'var(--border-card)',
                    background: activeFilter === f.name ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                    cursor: file ? 'pointer' : 'not-allowed', opacity: file ? 1 : 0.4,
                    transition: 'all 0.15s ease', textAlign: 'left', fontFamily: 'inherit',
                  }}
                  aria-pressed={activeFilter === f.name}
                  aria-label={f.label}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: activeFilter === f.name ? 'var(--mint)' : 'var(--text-primary)' }}>
                    {f.label}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {f.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Intensity slider */}
          {activeFilter !== 'none' && file && (
            <div className="card card-sm fade-up">
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Intensity</span>
                <span style={{ color: 'var(--mint)' }} className="mono">{Math.round(intensity * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.01} value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
                disabled={isApplying}
              />
            </div>
          )}

          {/* Download */}
          {file && (
            <button className="btn btn-secondary" onClick={downloadResult} id="download-filtered-btn">
              <Download size={15} /> Download PNG
            </button>
          )}
        </div>

        {/* Right — canvas preview */}
        <div className="card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!file ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
              <Sliders size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: '14px' }}>Upload an image to apply pixel filters</p>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Canvas Preview
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isApplying && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={11} className="spin" /> Applying…
                    </span>
                  )}
                  {activeFilter !== 'none' && (
                    <span className="badge badge-mint">{FILTERS.find(f => f.name === activeFilter)?.label}</span>
                  )}
                </div>
              </div>

              <div style={{
                flex: 1, overflow: 'auto', borderRadius: '10px', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.5)', padding: '12px',
                position: 'relative',
              }}>
                {isApplying && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(15,23,42,0.6)', borderRadius: '10px', zIndex: 2,
                  }}>
                    <RefreshCw size={28} className="spin" style={{ color: 'var(--mint)' }} />
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  aria-label="Filtered image preview"
                  style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '6px', display: 'block' }}
                />
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Pixel manipulation via <code style={{ color: 'var(--mint)' }}>ctx.getImageData()</code> — no CSS filters, pure math.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
