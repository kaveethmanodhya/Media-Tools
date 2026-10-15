'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Layers, UploadCloud, Download, RefreshCw, X, Grid } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface SpriteFrame {
  id: string;
  name: string;
  img: HTMLImageElement;
  width: number;
  height: number;
  blob: Blob;
  previewUrl: string;
  x?: number;
  y?: number;
}

interface SpriteCoord {
  frame: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SpritesheetMaker() {
  const [frames, setFrames] = useState<SpriteFrame[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [cols, setCols] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sheetWidth, setSheetWidth] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetSize, setSheetSize] = useState(0);
  const [coords, setCoords] = useState<SpriteCoord[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async (files: File[]) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const valid = files.filter((f) => validTypes.includes(f.type));
    if (valid.length === 0) return;

    const loaded: SpriteFrame[] = await Promise.all(
      valid.map(
        (f) =>
          new Promise<SpriteFrame>((resolve, reject) => {
            const url = URL.createObjectURL(f);
            const img = new Image();
            img.onload = () => {
              resolve({
                id: crypto.randomUUID(),
                name: f.name,
                img,
                width: img.naturalWidth,
                height: img.naturalHeight,
                blob: f,
                previewUrl: url,
              });
            };
            img.onerror = reject;
            img.src = url;
          })
      )
    );

    setFrames((prev) => [...prev, ...loaded]);
    setPreviewUrl(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      loadImages(Array.from(e.dataTransfer.files));
    },
    [loadImages]
  );

  const removeFrame = (id: string) => {
    setFrames((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    setPreviewUrl(null);
  };

  const generateSheet = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);

    try {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      // Use max frame dimensions for uniform grid
      const maxW = Math.max(...frames.map((f) => f.width));
      const maxH = Math.max(...frames.map((f) => f.height));
      const numCols = Math.min(cols, frames.length);
      const numRows = Math.ceil(frames.length / numCols);

      canvas.width = numCols * maxW;
      canvas.height = numRows * maxH;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const coordMap: SpriteCoord[] = [];

      frames.forEach((frame, i) => {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        const x = col * maxW;
        const y = row * maxH;

        // Center the image in the cell
        const offsetX = Math.floor((maxW - frame.width) / 2);
        const offsetY = Math.floor((maxH - frame.height) / 2);

        ctx.drawImage(frame.img, x + offsetX, y + offsetY, frame.width, frame.height);

        coordMap.push({
          frame: frame.name,
          x,
          y,
          width: frame.width,
          height: frame.height,
        });
      });

      setSheetWidth(canvas.width);
      setSheetHeight(canvas.height);
      setCoords(coordMap);

      // Generate preview URL
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.9)
      );
      if (blob) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setSheetSize(blob.size);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSheet = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.9)
    );
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spritesheet.webp';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadJSON = () => {
    const data = JSON.stringify(
      {
        meta: { sheet: 'spritesheet.webp', width: sheetWidth, height: sheetHeight },
        frames: coords,
      },
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spritesheet.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    frames.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFrames([]);
    setPreviewUrl(null);
    setCoords([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Stats */}
      {frames.length > 0 && (
        <div className="stat-row fade-up">
          <div className="stat-tile">
            <div className="stat-value">{frames.length}</div>
            <div className="stat-label">Frames</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{sheetWidth || '—'}</div>
            <div className="stat-label">Sheet W (px)</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{sheetSize ? formatFileSize(sheetSize) : '—'}</div>
            <div className="stat-label">Sheet Size</div>
          </div>
        </div>
      )}

      <div className="tool-grid">
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Upload */}
          <div
            className={`upload-zone${isDragging ? ' dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <UploadCloud size={22} />
            </div>
            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Drop frames here
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PNG · WebP · JPEG</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => e.target.files && loadImages(Array.from(e.target.files))}
              aria-label="Upload sprite frames"
            />
          </div>

          {/* Grid settings */}
          <div className="card card-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Grid size={15} style={{ color: 'var(--mint)' }} />
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Grid Settings</span>
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Columns</span>
                <span style={{ color: 'var(--mint)' }} className="mono">{cols}</span>
              </label>
              <input
                type="range" min={1} max={16} step={1} value={cols}
                onChange={(e) => setCols(parseInt(e.target.value))}
                disabled={isGenerating}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>1</span><span>16</span>
              </div>
            </div>

            {frames.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                → {Math.min(cols, frames.length)} × {Math.ceil(frames.length / Math.min(cols, frames.length))} grid
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn btn-primary"
              disabled={frames.length === 0 || isGenerating}
              onClick={generateSheet}
              id="generate-sheet-btn"
            >
              {isGenerating ? <RefreshCw size={16} className="spin" /> : <Layers size={16} />}
              {isGenerating ? 'Generating…' : 'Generate Sprite Sheet'}
            </button>

            {previewUrl && (
              <>
                <button className="btn btn-secondary" onClick={downloadSheet} id="download-sheet-btn">
                  <Download size={15} /> Download WebP
                </button>
                <button className="btn btn-secondary" onClick={downloadJSON} id="download-json-btn">
                  <Download size={15} /> Download JSON Map
                </button>
              </>
            )}

            {frames.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                <X size={13} /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Right — preview */}
        <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!previewUrl ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Thumbnail grid of loaded frames */}
              {frames.length > 0 ? (
                <>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {frames.length} frames loaded — configure grid and click Generate.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                    {frames.map((f) => (
                      <div key={f.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={f.previewUrl} alt={f.name} style={{ width: '100%', height: '60px', objectFit: 'cover', display: 'block' }} />
                        <button
                          onClick={() => removeFrame(f.id)}
                          style={{
                            position: 'absolute', top: '2px', right: '2px',
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171',
                          }}
                          aria-label={`Remove frame ${f.name}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                  <Layers size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
                  <p style={{ fontSize: '14px' }}>Add frames to build a sprite sheet</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Sprite Sheet Preview</span>
                <span className="badge badge-mint">{sheetWidth} × {sheetHeight}px</span>
              </div>
              <div style={{
                flex: 1, overflow: 'auto', background: 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px',
                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)', padding: '12px',
              }}>
                <img
                  src={previewUrl}
                  alt="Sprite sheet preview"
                  style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '6px' }}
                />
              </div>
              {coords.length > 0 && (
                <details style={{ fontSize: '12px' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--mint)', fontWeight: 600 }}>
                    JSON Coordinate Map ({coords.length} frames)
                  </summary>
                  <pre style={{
                    marginTop: '8px', background: 'rgba(15,23,42,0.8)', borderRadius: '8px',
                    padding: '12px', overflow: 'auto', maxHeight: '200px',
                    color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace',
                    border: '1px solid var(--border)',
                  }}>
                    {JSON.stringify({ frames: coords.slice(0, 3) }, null, 2)}
                    {coords.length > 3 && `\n  // … and ${coords.length - 3} more`}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
