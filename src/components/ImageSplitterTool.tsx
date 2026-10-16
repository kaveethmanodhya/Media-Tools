'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scissors,
  Download,
  UploadCloud,
  Grid,
  Columns,
  Rows,
  Layers,
  Sparkles,
  FileArchive,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw,
  Eye,
  Sliders
} from 'lucide-react';
import JSZip from 'jszip';
import {
  baseName,
  canvasBlob,
  downloadBlob,
  extensionFor,
  readImage,
  type ExportImageFormat
} from '@/lib/additionalMedia';
import { formatFileSize } from '@/lib/utils';
import { recordDownload } from '@/lib/usageClient';

export type SplitMode = 'grid' | 'fixed_size';

export interface SplitTile {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  blob: Blob;
  url: string;
}

const PRESETS = [
  {
    id: 'ig-3x3',
    label: 'Instagram 3×3 Grid',
    desc: '9 square posts for a giant 3×3 profile feed banner',
    rows: 3,
    cols: 3,
  },
  {
    id: 'ig-3x1',
    label: 'Instagram 3×1 Carousel',
    desc: '3 sequential horizontal slides for seamless swipe panoramas',
    rows: 1,
    cols: 3,
  },
  {
    id: 'ig-2x1',
    label: 'Instagram 2×1 Panorama',
    desc: '2 wide slides for seamless side-by-side feed swipe',
    rows: 1,
    cols: 2,
  },
  {
    id: 'story-1x3',
    label: 'Story Strip (1×3)',
    desc: '3 vertical slices for Instagram/TikTok stories',
    rows: 3,
    cols: 1,
  },
  {
    id: 'quad-2x2',
    label: '2×2 Quad Grid',
    desc: '4 equal quadrants',
    rows: 2,
    cols: 2,
  },
];

const FORMATS: { label: string; value: ExportImageFormat }[] = [
  { label: 'PNG (Lossless)', value: 'image/png' },
  { label: 'WebP (Modern)', value: 'image/webp' },
  { label: 'JPEG (Standard)', value: 'image/jpeg' },
];

export function ImageSplitterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Split Configuration
  const [mode, setMode] = useState<SplitMode>('grid');
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);
  const [fixedWidth, setFixedWidth] = useState<number>(1080);
  const [fixedHeight, setFixedHeight] = useState<number>(1080);
  const [activePreset, setActivePreset] = useState<string>('ig-3x3');

  // Format & Quality
  const [format, setFormat] = useState<ExportImageFormat>('image/png');
  const [quality, setQuality] = useState<number>(0.92);

  // Results
  const [tiles, setTiles] = useState<SplitTile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [namingPrefix, setNamingPrefix] = useState<string>('part');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when tiles change or unmount
  useEffect(() => {
    return () => {
      tiles.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, [tiles]);

  // Load image
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP, etc.).');
      return;
    }
    setFile(f);
    setError('');
    setTiles([]);
    setNamingPrefix(baseName(f.name));

    readImage(f)
      .then((img) => {
        setImgElement(img);
        setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to decode image.');
      });
  }, []);

  // Preset selector
  const handleSelectPreset = (presetId: string) => {
    setActivePreset(presetId);
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setMode('grid');
      setRows(p.rows);
      setCols(p.cols);
    }
  };

  // Perform Slicing
  const processSplit = async () => {
    if (!imgElement || !file) return;

    setIsProcessing(true);
    setError('');

    // Revoke previous URLs
    tiles.forEach((t) => URL.revokeObjectURL(t.url));
    setTiles([]);

    try {
      const origW = imgElement.naturalWidth;
      const origH = imgElement.naturalHeight;

      let computedRows = rows;
      let computedCols = cols;
      let sliceW = 0;
      let sliceH = 0;

      if (mode === 'grid') {
        computedRows = Math.max(1, Math.min(20, rows));
        computedCols = Math.max(1, Math.min(20, cols));
        sliceW = Math.floor(origW / computedCols);
        sliceH = Math.floor(origH / computedRows);
      } else {
        // Fixed dimensions
        sliceW = Math.max(10, Math.min(origW, fixedWidth));
        sliceH = Math.max(10, Math.min(origH, fixedHeight));
        computedCols = Math.ceil(origW / sliceW);
        computedRows = Math.ceil(origH / sliceH);
      }

      if (sliceW <= 0 || sliceH <= 0 || computedRows * computedCols > 100) {
        throw new Error('Too many parts generated (maximum 100 tiles). Adjust rows, columns, or tile sizes.');
      }

      const generated: SplitTile[] = [];
      let index = 1;

      for (let r = 0; r < computedRows; r++) {
        for (let c = 0; c < computedCols; c++) {
          const sx = c * sliceW;
          const sy = r * sliceH;
          const sw = Math.min(sliceW, origW - sx);
          const sh = Math.min(sliceH, origH - sy);

          if (sw <= 0 || sh <= 0) continue;

          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not create canvas context.');

          // If JPEG, fill white background for transparent images
          if (format === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sw, sh);
          }

          ctx.drawImage(imgElement, sx, sy, sw, sh, 0, 0, sw, sh);

          const blob = await canvasBlob(canvas, format, quality);
          const url = URL.createObjectURL(blob);

          generated.push({
            index,
            row: r + 1,
            col: c + 1,
            x: sx,
            y: sy,
            width: sw,
            height: sh,
            blob,
            url,
          });

          index++;
        }
      }

      setTiles(generated);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Image slicing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download single tile
  const handleDownloadSingle = (tile: SplitTile) => {
    if (!file) return;
    const ext = extensionFor(format);
    const prefix = namingPrefix.trim() || 'part';
    const num = String(tile.index).padStart(2, '0');
    downloadBlob(tile.blob, `${prefix}_part_${num}.${ext}`);
  };

  // Download all as ZIP
  const handleDownloadZip = async () => {
    if (tiles.length === 0 || !file) return;

    setIsZipping(true);
    setError('');

    try {
      const zip = new JSZip();
      const ext = extensionFor(format);
      const prefix = namingPrefix.trim() || 'part';

      tiles.forEach((tile) => {
        const num = String(tile.index).padStart(2, '0');
        const filename = `${prefix}_part_${num}_(r${tile.row}_c${tile.col}).${ext}`;
        zip.file(filename, tile.blob);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      downloadBlob(zipBlob, `${prefix}_parts_${tiles.length}x.zip`);
      recordDownload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ZIP generation failed.');
    } finally {
      setIsZipping(false);
    }
  };

  // Calculated tile dimensions for guide
  const effectiveCols = mode === 'grid' ? cols : Math.ceil(dimensions.w / (fixedWidth || 1));
  const effectiveRows = mode === 'grid' ? rows : Math.ceil(dimensions.h / (fixedHeight || 1));
  const previewSliceW = dimensions.w ? Math.round(dimensions.w / effectiveCols) : 0;
  const previewSliceH = dimensions.h ? Math.round(dimensions.h / effectiveRows) : 0;
  const totalParts = effectiveCols * effectiveRows;

  return (
    <div className="extra-tool" style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Tool Header */}
      <div className="extra-tool-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="tool-icon-badge"
            style={{
              background: 'rgba(255, 90, 9, 0.15)',
              color: 'var(--orange-primary)',
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Scissors size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Image Splitter & Grid Cutter
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Slice images into grids, rows, columns, or Instagram 3×3 & swipe panorama carousels. Download individual parts or all in a single ZIP.
            </p>
          </div>
        </div>
      </div>

      <div
        className="extra-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 380px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Controls */}
        <div
          className="extra-panel extra-controls"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-charcoal)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}
        >
          {/* File Picker */}
          {!file ? (
            <label
              className="extra-picker"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px 20px',
                border: '2px dashed var(--border-charcoal)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'border-color 0.2s',
              }}
            >
              <UploadCloud size={32} style={{ color: 'var(--orange-primary)', marginBottom: '8px' }} />
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Select an image to split</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                PNG, JPG, WebP, BMP, or HEIC (Processed locally)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-charcoal)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    maxWidth: '200px',
                  }}
                >
                  {file.name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {dimensions.w} × {dimensions.h} px • {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                onClick={() => {
                  setFile(null);
                  setImgElement(null);
                  setTiles([]);
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Presets */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Popular Presets
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PRESETS.map((p) => {
                const isSelected = activePreset === p.id && mode === 'grid';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: isSelected ? 'rgba(255, 90, 9, 0.12)' : 'var(--bg-tertiary)',
                      border: isSelected ? '1px solid var(--orange-primary)' : '1px solid var(--border-charcoal)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--orange-primary)' : 'var(--text-primary)' }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.desc}</div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {p.rows * p.cols} parts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Cutting Mode
            </label>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              <button
                type="button"
                className={`extra-option ${mode === 'grid' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px', border: 'none' }}
                onClick={() => {
                  setMode('grid');
                  setActivePreset('custom');
                }}
              >
                <Grid size={13} style={{ marginRight: '6px', verticalAlign: '-1px' }} />
                Rows × Columns
              </button>
              <button
                type="button"
                className={`extra-option ${mode === 'fixed_size' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px', border: 'none' }}
                onClick={() => {
                  setMode('fixed_size');
                  setActivePreset('custom');
                }}
              >
                <Sliders size={13} style={{ marginRight: '6px', verticalAlign: '-1px' }} />
                Fixed Tile Size
              </button>
            </div>
          </div>

          {/* Configuration Inputs */}
          {mode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Columns (Vertical cuts)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Columns size={15} style={{ color: 'var(--orange-primary)' }} />
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={cols}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 1));
                      setCols(v);
                      setActivePreset('custom');
                    }}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Rows (Horizontal cuts)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Rows size={15} style={{ color: 'var(--orange-primary)' }} />
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={rows}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 1));
                      setRows(v);
                      setActivePreset('custom');
                    }}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Tile Width (px)
                </label>
                <input
                  type="number"
                  min="50"
                  max={dimensions.w || 10000}
                  value={fixedWidth}
                  onChange={(e) => setFixedWidth(parseInt(e.target.value, 10) || 100)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Tile Height (px)
                </label>
                <input
                  type="number"
                  min="50"
                  max={dimensions.h || 10000}
                  value={fixedHeight}
                  onChange={(e) => setFixedHeight(parseInt(e.target.value, 10) || 100)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}

          {/* Slicing Summary detail */}
          {dimensions.w > 0 && (
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <div>
                <strong>Total Parts:</strong> {totalParts} ({effectiveCols} cols × {effectiveRows} rows)
              </div>
              <div>
                <strong>Tile Size:</strong> ~{previewSliceW} × {previewSliceH} px each
              </div>
            </div>
          )}

          {/* Export Settings */}
          <div style={{ borderTop: '1px solid var(--border-charcoal)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportImageFormat)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px' }}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  File Prefix
                </label>
                <input
                  type="text"
                  value={namingPrefix}
                  onChange={(e) => setNamingPrefix(e.target.value)}
                  placeholder="part"
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px' }}
                />
              </div>
            </div>

            {/* Split Action Button */}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!file || !imgElement || isProcessing}
              onClick={processSplit}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Scissors size={16} />
              {isProcessing ? 'Slicing Image…' : `Cut into ${totalParts} Parts`}
            </button>

            {/* Download All as ZIP Button (Available after splitting) */}
            {tiles.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isZipping}
                onClick={handleDownloadZip}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'rgba(255, 90, 9, 0.1)',
                  borderColor: 'var(--orange-primary)',
                  color: 'var(--orange-primary)',
                }}
              >
                <FileArchive size={16} />
                {isZipping ? 'Creating ZIP Archive…' : `Download All (${tiles.length}) as ZIP`}
              </button>
            )}

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: '12px', margin: 0, textAlign: 'center' }}>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Visual Grid Overlay & Tile Gallery */}
        <div
          className="extra-panel extra-preview"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-charcoal)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            minHeight: '480px',
          }}
        >
          {/* Section 1: Visual Cut Guide on Original Image */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-charcoal)',
                paddingBottom: '10px',
                marginBottom: '14px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Visual Cut Preview
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {effectiveCols} columns × {effectiveRows} rows
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                background: '#0e0e0e',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                minHeight: '260px',
              }}
            >
              {!file ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Scissors size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p style={{ fontSize: '14px', margin: 0 }}>Upload an image to see the interactive cutting grid.</p>
                </div>
              ) : (
                <div
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    maxWidth: '100%',
                    maxHeight: '420px',
                  }}
                >
                  {/* Image */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Source"
                    style={{
                      display: 'block',
                      maxWidth: '100%',
                      maxHeight: '420px',
                      objectFit: 'contain',
                    }}
                  />

                  {/* SVG / CSS Cut Grid Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
                      gridTemplateRows: `repeat(${effectiveRows}, 1fr)`,
                      pointerEvents: 'none',
                    }}
                  >
                    {Array.from({ length: totalParts }).map((_, i) => {
                      const rowIdx = Math.floor(i / effectiveCols);
                      const colIdx = i % effectiveCols;
                      return (
                        <div
                          key={i}
                          style={{
                            borderRight: colIdx < effectiveCols - 1 ? '1.5px dashed var(--orange-primary)' : 'none',
                            borderBottom: rowIdx < effectiveRows - 1 ? '1.5px dashed var(--orange-primary)' : 'none',
                            position: 'relative',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: '4px',
                              left: '4px',
                              background: 'rgba(0, 0, 0, 0.75)',
                              color: 'var(--orange-primary)',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              border: '1px solid rgba(255, 90, 9, 0.4)',
                            }}
                          >
                            #{i + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Generated Slices Gallery */}
          {tiles.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-charcoal)',
                  paddingBottom: '10px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--orange-primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Generated Slices ({tiles.length})
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isZipping}
                  onClick={handleDownloadZip}
                  style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileArchive size={13} /> Download All (ZIP)
                </button>
              </div>

              {/* Grid of tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(130px, 1fr))`,
                  gap: '12px',
                  maxHeight: '420px',
                  overflowY: 'auto',
                  padding: '4px',
                }}
              >
                {tiles.map((tile) => (
                  <div
                    key={tile.index}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-charcoal)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        aspectRatio: `${tile.width} / ${tile.height}`,
                        maxHeight: '120px',
                        background: '#0a0a0a',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={tile.url}
                        alt={`Part ${tile.index}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          background: 'rgba(0,0,0,0.8)',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        #{tile.index}
                      </span>
                    </div>

                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {tile.width} × {tile.height} px
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDownloadSingle(tile)}
                        style={{
                          padding: '5px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          width: '100%',
                        }}
                      >
                        <Download size={12} /> Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-charcoal)',
              paddingTop: '10px',
              marginTop: 'auto',
            }}
          >
            <span>🔒 Cut & slice performed completely in memory.</span>
            <span>No image data leaves your device.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
