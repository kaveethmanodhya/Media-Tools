'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Maximize2,
  Download,
  UploadCloud,
  Sparkles,
  Sliders,
  RefreshCw,
  Zap,
  CheckCircle2,
  Split,
  Eye,
  X
} from 'lucide-react';
import {
  baseName,
  canvasBlob,
  downloadBlob,
  extensionFor,
  readImage,
  type ExportImageFormat
} from '@/lib/additionalMedia';
import { enhanceAndUpscaleImage } from '@/lib/imageEnhancer';
import { formatFileSize } from '@/lib/utils';

type UpscalePreset = 'clarity' | 'balanced' | 'art' | 'natural';

interface PresetConfig {
  name: UpscalePreset;
  label: string;
  desc: string;
  sharpness: number;
  clarity: number;
  contrastBoost: number;
  denoise: number;
}

const PRESETS: Record<UpscalePreset, PresetConfig> = {
  clarity: {
    name: 'clarity',
    label: 'Ultra Clarity',
    desc: 'Maximum edge definition, unsharp masking & crisp contours. Ideal for blurry or low-res photos.',
    sharpness: 1.6,
    clarity: 0.55,
    contrastBoost: 0.35,
    denoise: 0.25,
  },
  balanced: {
    name: 'balanced',
    label: 'Balanced Super-Res',
    desc: 'Natural texture pop, micro-contrast recovery & balanced noise reduction.',
    sharpness: 1.2,
    clarity: 0.35,
    contrastBoost: 0.25,
    denoise: 0.3,
  },
  art: {
    name: 'art',
    label: 'Graphics & Anime',
    desc: 'Strong boundary lines and clean flat shading with JPEG compression smoothing.',
    sharpness: 1.8,
    clarity: 0.25,
    contrastBoost: 0.4,
    denoise: 0.55,
  },
  natural: {
    name: 'natural',
    label: 'Natural Soft',
    desc: 'Gentle detail enhancement without altering natural camera film grain.',
    sharpness: 0.7,
    clarity: 0.2,
    contrastBoost: 0.15,
    denoise: 0.15,
  },
};

const FORMATS: { label: string; value: ExportImageFormat }[] = [
  { label: 'PNG (Lossless)', value: 'image/png' },
  { label: 'WebP (Modern)', value: 'image/webp' },
  { label: 'JPEG (Standard)', value: 'image/jpeg' },
];

export function ImageUpscalerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [factor, setFactor] = useState<number>(2);
  const [preset, setPreset] = useState<UpscalePreset>('clarity');
  const [format, setFormat] = useState<ExportImageFormat>('image/png');
  const [quality, setQuality] = useState<number>(0.92);

  // Sliders initialized from preset
  const [sharpness, setSharpness] = useState<number>(1.6);
  const [clarity, setClarity] = useState<number>(0.55);
  const [contrastBoost, setContrastBoost] = useState<number>(0.35);
  const [denoise, setDenoise] = useState<number>(0.25);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputDimensions, setOutputDimensions] = useState({ w: 0, h: 0 });

  // URLs
  const [inputUrl, setInputUrl] = useState<string>('');
  const [outputUrl, setOutputUrl] = useState<string>('');

  // Split comparison slider (0 to 100%)
  const [splitPos, setSplitPos] = useState<number>(50);
  const isDraggingSplitRef = useRef<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply preset
  const handleSelectPreset = (p: UpscalePreset) => {
    setPreset(p);
    const cfg = PRESETS[p];
    setSharpness(cfg.sharpness);
    setClarity(cfg.clarity);
    setContrastBoost(cfg.contrastBoost);
    setDenoise(cfg.denoise);
  };

  // Image loading
  const handleFile = useCallback((f: File) => {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/bmp'];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.bmp'];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (!f.type.startsWith('image/') && !validMimes.includes(f.type) && !validExts.includes(ext)) {
      alert('Please select a valid image file (JPEG, PNG, WebP, or HEIC).');
      return;
    }

    setFile(f);
    setOutputBlob(null);
    setOutputUrl('');
    setError('');
    setProgress(0);
    setStatusMsg('');

    const url = URL.createObjectURL(f);
    setInputUrl(url);

    readImage(f)
      .then((img) => {
        setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [inputUrl, outputUrl]);

  // Main Upscale & Enhance Action
  const processUpscale = async () => {
    if (!file || !dimensions.w) return;

    const targetW = dimensions.w * factor;
    const targetH = dimensions.h * factor;

    if (targetW > 8192 || targetH > 8192 || targetW * targetH > 36_000_000) {
      setError('Target dimensions exceed maximum canvas limit (8192px / 36MP). Choose a smaller scale factor.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setProgress(5);
    setStatusMsg('Reading original image data…');

    try {
      const img = await readImage(file);
      const res = await enhanceAndUpscaleImage(
        img,
        {
          scaleFactor: factor,
          targetWidth: targetW,
          targetHeight: targetH,
          sharpness,
          clarity,
          contrastBoost,
          denoise,
          mode: preset,
        },
        (pct, stage) => {
          setProgress(pct);
          setStatusMsg(stage);
        }
      );

      setStatusMsg('Encoding enhanced output…');
      const blob = await canvasBlob(res.canvas, format, quality);
      const url = URL.createObjectURL(blob);

      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(url);
      setOutputBlob(blob);
      setOutputDimensions({ w: res.width, h: res.height });
      setSplitPos(50);
      setStatusMsg('Enhancement complete!');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Upscaling failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Split compare drag handlers
  const updateSplitFromX = (clientX: number) => {
    if (!splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSplitPos((x / rect.width) * 100);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingSplitRef.current = true;
    updateSplitFromX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplitRef.current) {
      updateSplitFromX(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSplitRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Download
  const handleDownload = () => {
    if (!outputBlob || !file) return;
    const base = baseName(file.name);
    const ext = extensionFor(format);
    downloadBlob(outputBlob, `${base}_${factor}x_enhanced.${ext}`);
  };

  const resetAll = () => {
    setFile(null);
    setOutputBlob(null);
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setInputUrl('');
    setOutputUrl('');
    setDimensions({ w: 0, h: 0 });
    setOutputDimensions({ w: 0, h: 0 });
    setError('');
    setProgress(0);
  };

  return (
    <div className="extra-tool" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="extra-tool-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="tool-icon-badge" style={{ background: 'rgba(255, 90, 9, 0.15)', color: 'var(--orange-primary)' }}>
            <Maximize2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
              AI Super-Resolution & Image Enhancer
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Upscale low-resolution photos with adaptive unsharp masking, edge frequency reconstruction, and micro-contrast clarity boost.
            </p>
          </div>
        </div>
      </div>

      <div className="extra-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Controls Column */}
        <div className="extra-panel extra-controls" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* File Picker */}
          {!file ? (
            <label className="extra-picker" style={{ cursor: 'pointer' }}>
              <UploadCloud size={28} style={{ color: 'var(--orange-primary)' }} />
              <strong style={{ fontSize: '14px', marginTop: '6px' }}>Upload image to enhance</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>JPG, PNG, WebP, or HEIC</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp,.heic,.heif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          ) : (
            <div className="card card-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
              <div style={{ overflow: 'hidden' }}>
                <p className="truncate" style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  {file.name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {dimensions.w} × {dimensions.h} px · {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resetAll}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Change
              </button>
            </div>
          )}

          {/* Scale Factor */}
          <div className="card card-sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ margin: 0, fontWeight: 600, fontSize: '12px' }}>Upscale Multiplier</label>
              <span className="badge badge-mint" style={{ fontSize: '10px' }}>
                {factor}× Resolution
              </span>
            </div>
            <div className="extra-button-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`extra-option ${factor === n ? 'selected' : ''}`}
                  onClick={() => setFactor(n)}
                  disabled={!file || isProcessing}
                  style={{
                    padding: '8px 10px',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '8px',
                    borderColor: factor === n ? 'var(--orange-primary)' : undefined,
                    background: factor === n ? 'rgba(255, 90, 9, 0.15)' : undefined,
                    color: factor === n ? 'var(--orange-primary)' : undefined,
                  }}
                >
                  {n}× Super-Res
                </button>
              ))}
            </div>
            {dimensions.w > 0 && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
                Target size: <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dimensions.w * factor} × {dimensions.h * factor} px</span>
              </p>
            )}
          </div>

          {/* Clarity & Enhancement Presets */}
          <div className="card card-sm">
            <label style={{ marginBottom: '8px', fontWeight: 600, fontSize: '12px' }}>
              Quality Enhancement Profile
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(Object.keys(PRESETS) as UpscalePreset[]).map((key) => {
                const item = PRESETS[key];
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    disabled={!file || isProcessing}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: active ? 'var(--orange-primary)' : 'var(--border-charcoal)',
                      background: active ? 'rgba(255, 90, 9, 0.12)' : 'transparent',
                      cursor: file ? 'pointer' : 'not-allowed',
                      opacity: file ? 1 : 0.6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: active ? 'var(--orange-primary)' : 'var(--text-primary)' }}>
                        {item.label}
                      </span>
                      {active && <CheckCircle2 size={13} style={{ color: 'var(--orange-primary)' }} />}
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.3 }}>
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Advanced Tuning Toggle */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAdvanced((v) => !v)}
              style={{ marginTop: '10px', width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <Sliders size={12} /> {showAdvanced ? 'Hide Fine Adjustments' : 'Fine-Tune Clarity & Noise'}
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Edge Sharpness:</span>
                    <span className="mono" style={{ color: 'var(--orange-primary)' }}>{Math.round(sharpness * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.5"
                    step="0.05"
                    value={sharpness}
                    onChange={(e) => setSharpness(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Micro-Contrast / Pop:</span>
                    <span className="mono" style={{ color: 'var(--orange-primary)' }}>{Math.round(contrastBoost * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={contrastBoost}
                    onChange={(e) => setContrastBoost(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Texture Clarity:</span>
                    <span className="mono" style={{ color: 'var(--orange-primary)' }}>{Math.round(clarity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.05"
                    value={clarity}
                    onChange={(e) => setClarity(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Artifact Denoise:</span>
                    <span className="mono" style={{ color: 'var(--orange-primary)' }}>{Math.round(denoise * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={denoise}
                    onChange={(e) => setDenoise(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Export Format */}
          <div className="card card-sm">
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="upscale-format" style={{ marginBottom: '6px', fontSize: '12px' }}>Output Format</label>
                <select
                  id="upscale-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportImageFormat)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {format !== 'image/png' && (
                <div style={{ width: '90px' }}>
                  <label htmlFor="upscale-quality" style={{ marginBottom: '6px', fontSize: '12px' }}>Quality</label>
                  <input
                    id="upscale-quality"
                    type="number"
                    min={10}
                    max={100}
                    value={Math.round(quality * 100)}
                    onChange={(e) => setQuality(Math.min(1, Math.max(0.1, Number(e.target.value) / 100)))}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!file || !dimensions.w || isProcessing}
            onClick={processUpscale}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>{statusMsg || 'Enhancing pixels…'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Upscale & Enhance ({factor}×)</span>
              </>
            )}
          </button>

          {outputBlob && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={handleDownload}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Download size={16} />
              <span>Download Enhanced Image</span>
            </button>
          )}

          {error && <p className="extra-error" role="alert">{error}</p>}
        </div>

        {/* Preview / Stage Column */}
        <div className="extra-panel extra-preview" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {file ? (
            <div>
              {/* Header bar of preview */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {outputUrl ? 'Interactive Quality Compare (Slide to inspect)' : 'Original Low-Res Preview'}
                  </span>
                </div>
                {outputBlob && (
                  <span className="badge badge-mint" style={{ fontSize: '11px' }}>
                    {outputDimensions.w} × {outputDimensions.h} ({formatFileSize(outputBlob.size)})
                  </span>
                )}
              </div>

              {/* Viewport with Split Comparison Slider */}
              <div
                ref={splitContainerRef}
                onPointerDown={outputUrl ? handlePointerDown : undefined}
                onPointerMove={outputUrl ? handlePointerMove : undefined}
                onPointerUp={outputUrl ? handlePointerUp : undefined}
                onPointerCancel={outputUrl ? handlePointerUp : undefined}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '400px',
                  maxHeight: '620px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-charcoal)',
                  background: 'repeating-conic-gradient(#262626 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px',
                  userSelect: 'none',
                  touchAction: 'none',
                  cursor: outputUrl ? 'ew-resize' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* 1. Underlying: Enhanced High-Resolution Result */}
                {outputUrl ? (
                  <img
                    src={outputUrl}
                    alt="Upscaled and enhanced"
                    style={{
                      width: '100%',
                      height: '100%',
                      maxHeight: '600px',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                ) : (
                  <img
                    src={inputUrl}
                    alt="Original"
                    style={{
                      width: '100%',
                      height: '100%',
                      maxHeight: '600px',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                )}

                {/* 2. Overlaid: Original Low-Resolution Image (clipped by splitPos) */}
                {outputUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${splitPos}%`,
                      overflow: 'hidden',
                      pointerEvents: 'none',
                      borderRight: '2px solid var(--orange-primary)',
                      boxShadow: '2px 0 12px rgba(255, 90, 9, 0.4)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: splitContainerRef.current?.clientWidth || '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={inputUrl}
                        alt="Original before upscaling"
                        style={{
                          width: '100%',
                          height: '100%',
                          maxHeight: '600px',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 3. Slider Handle */}
                {outputUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${splitPos}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--orange-primary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  >
                    <Split size={16} />
                  </div>
                )}

                {/* Comparison badges */}
                {outputUrl && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(4px)',
                        padding: '4px 8px',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }}
                    >
                      Original ({dimensions.w} × {dimensions.h})
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '12px',
                        background: 'rgba(255, 90, 9, 0.85)',
                        backdropFilter: 'blur(4px)',
                        padding: '4px 8px',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }}
                    >
                      Enhanced ({outputDimensions.w} × {outputDimensions.h})
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="extra-empty" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Maximize2 size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Upload a photo to see the super-resolution difference</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Blurs and low-res pixelation are cleaned up with adaptive edge sharpening.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
