'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Stamp,
  Download,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Eye,
  EyeOff,
  Move,
  Type,
  Sparkles,
  Grid,
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import {
  baseName,
  canvasBlob,
  downloadBatch,
  downloadBlob,
  extensionFor,
  makeCanvas,
  readImage,
  type ExportImageFormat
} from '@/lib/additionalMedia';

type WatermarkMode = 'text' | 'image' | 'both';
type GridPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'center' | 'mr' | 'bl' | 'bc' | 'br';
type WatermarkPosition = GridPosition | 'tile' | 'custom';

interface PositionDef {
  id: GridPosition;
  label: string;
  icon: string;
}

const GRID_POSITIONS: PositionDef[] = [
  { id: 'tl', label: 'Top Left', icon: '↖' },
  { id: 'tc', label: 'Top Center', icon: '↑' },
  { id: 'tr', label: 'Top Right', icon: '↗' },
  { id: 'ml', label: 'Middle Left', icon: '←' },
  { id: 'center', label: 'Center', icon: '·' },
  { id: 'mr', label: 'Middle Right', icon: '→' },
  { id: 'bl', label: 'Bottom Left', icon: '↙' },
  { id: 'bc', label: 'Bottom Center', icon: '↓' },
  { id: 'br', label: 'Bottom Right', icon: '↘' }
];

const COLOR_PRESETS = [
  { label: 'White', color: '#ffffff' },
  { label: 'Black', color: '#111111' },
  { label: 'Flame Orange', color: '#FF5A09' },
  { label: 'Amber', color: '#ec7f37' },
  { label: 'Mint', color: '#10b981' },
  { label: 'Sky Blue', color: '#38bdf8' }
];

const TEXT_PRESETS = ['© MediaTools', 'CONFIDENTIAL', 'SAMPLE', 'PREVIEW', 'DO NOT COPY'];

interface WatermarkSettings {
  mode: WatermarkMode;
  text: string;
  textColor: string;
  withPill: boolean;
  logoImg: HTMLImageElement | null;
  position: WatermarkPosition;
  customCoords: { x: number; y: number };
  opacity: number;
  scale: number;
  rotation: number;
  marginPercent: number;
}

interface WatermarkBox {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  logoW: number;
  logoH: number;
}

function computeWatermarkBox(
  width: number,
  height: number,
  settings: WatermarkSettings,
  ctx?: CanvasRenderingContext2D
): WatermarkBox | null {
  const { mode, text, logoImg, scale, position, customCoords, marginPercent } = settings;
  const textTrimmed = text.trim();
  const hasText = (mode === 'text' || mode === 'both') && textTrimmed.length > 0;
  const hasLogo = (mode === 'image' || mode === 'both') && !!logoImg;

  if (!hasText && !hasLogo) return null;

  let logoW = 0;
  let logoH = 0;
  if (hasLogo && logoImg) {
    logoW = Math.max(20, Math.round(width * (scale / 100)));
    logoH = Math.round(logoW * (logoImg.naturalHeight / logoImg.naturalWidth));
  }

  let fontSize = 0;
  let textW = 0;
  let textH = 0;
  if (hasText) {
    fontSize = hasLogo
      ? Math.max(12, Math.round(logoH * 0.3))
      : Math.max(14, Math.round(width * (scale / 100) * 0.28));

    if (ctx) {
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      textW = ctx.measureText(textTrimmed).width;
    } else {
      textW = textTrimmed.length * fontSize * 0.62;
    }
    textH = fontSize * 1.25;
  }

  let totalW = 0;
  let totalH = 0;
  if (hasLogo && hasText) {
    totalW = Math.max(logoW, textW);
    totalH = logoH + 8 + textH;
  } else if (hasLogo) {
    totalW = logoW;
    totalH = logoH;
  } else {
    totalW = textW;
    totalH = textH;
  }

  const margin = Math.max(10, Math.round(width * (marginPercent / 100)));
  let left = 0;
  let top = 0;

  switch (position) {
    case 'tl':
      left = margin;
      top = margin;
      break;
    case 'tc':
      left = (width - totalW) / 2;
      top = margin;
      break;
    case 'tr':
      left = width - totalW - margin;
      top = margin;
      break;
    case 'ml':
      left = margin;
      top = (height - totalH) / 2;
      break;
    case 'center':
      left = (width - totalW) / 2;
      top = (height - totalH) / 2;
      break;
    case 'mr':
      left = width - totalW - margin;
      top = (height - totalH) / 2;
      break;
    case 'bl':
      left = margin;
      top = height - totalH - margin;
      break;
    case 'bc':
      left = (width - totalW) / 2;
      top = height - totalH - margin;
      break;
    case 'br':
      left = width - totalW - margin;
      top = height - totalH - margin;
      break;
    case 'custom':
      left = Math.max(0, Math.min(width - totalW, customCoords.x * (width - totalW)));
      top = Math.max(0, Math.min(height - totalH, customCoords.y * (height - totalH)));
      break;
    default:
      left = width - totalW - margin;
      top = height - totalH - margin;
  }

  return { left, top, width: totalW, height: totalH, fontSize, logoW, logoH };
}

function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  settings: WatermarkSettings
) {
  const { mode, text, textColor, withPill, logoImg, opacity, rotation, position } = settings;
  const textTrimmed = text.trim();

  if (position === 'tile') {
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    const stepX = Math.max(160, Math.round(canvasW * 0.28));
    const stepY = Math.max(120, Math.round(canvasH * 0.22));
    const tileSize = Math.max(13, Math.round(canvasW * 0.024));
    ctx.font = `700 ${tileSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.strokeStyle = textColor === '#000000' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const countX = Math.ceil(canvasW / stepX) + 2;
    const countY = Math.ceil(canvasH / stepY) + 2;

    for (let ix = -1; ix < countX; ix++) {
      for (let iy = -1; iy < countY; iy++) {
        const cx = ix * stepX + (iy % 2 === 0 ? 0 : stepX / 2);
        const cy = iy * stepY;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((rotation || -30) * Math.PI) / 180);

        if (logoImg && (mode === 'image' || mode === 'both')) {
          const lw = Math.max(28, Math.round(canvasW * 0.06));
          const lh = Math.round(lw * (logoImg.naturalHeight / logoImg.naturalWidth));
          ctx.drawImage(logoImg, -lw / 2, -lh / 2, lw, lh);
        }
        if (textTrimmed && (mode === 'text' || mode === 'both')) {
          const ty = logoImg && mode === 'both' ? 24 : 0;
          ctx.strokeText(textTrimmed, 0, ty);
          ctx.fillText(textTrimmed, 0, ty);
        }
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  const box = computeWatermarkBox(canvasW, canvasH, settings, ctx);
  if (!box) return;

  const { left, top, width: markW, height: markH, fontSize, logoW, logoH } = box;
  const centerX = left + markW / 2;
  const centerY = top + markH / 2;

  ctx.save();
  ctx.globalAlpha = opacity / 100;
  ctx.translate(centerX, centerY);
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  if (withPill) {
    const padX = Math.max(10, Math.round(fontSize * 0.6));
    const padY = Math.max(6, Math.round(fontSize * 0.4));
    const pillW = markW + padX * 2;
    const pillH = markH + padY * 2;
    const radius = Math.min(10, Math.round(pillH * 0.25));

    ctx.fillStyle = 'rgba(18, 18, 18, 0.76)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, radius);
    } else {
      ctx.rect(-pillW / 2, -pillH / 2, pillW, pillH);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let currY = -markH / 2;

  if (logoImg && (mode === 'image' || mode === 'both')) {
    ctx.drawImage(logoImg, -logoW / 2, currY, logoW, logoH);
    currY += logoH + 8;
  }

  if (textTrimmed && (mode === 'text' || mode === 'both')) {
    ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    ctx.lineWidth = Math.max(2.5, Math.round(fontSize / 7.5));
    ctx.strokeStyle = textColor === '#000000' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
    ctx.lineJoin = 'round';
    ctx.strokeText(textTrimmed, 0, currY);

    ctx.fillStyle = textColor;
    ctx.fillText(textTrimmed, 0, currY);
  }

  ctx.restore();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function ImageWatermarkTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);

  // Watermark options
  const [mode, setMode] = useState<WatermarkMode>('both');
  const [text, setText] = useState('© MediaTools');
  const [textColor, setTextColor] = useState('#ffffff');
  const [withPill, setWithPill] = useState(false);

  // Logo Watermark
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoDimensions, setLogoDimensions] = useState<{ w: number; h: number } | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Placement & Styling
  const [position, setPosition] = useState<WatermarkPosition>('br');
  const [customCoords, setCustomCoords] = useState<{ x: number; y: number }>({ x: 0.85, y: 0.85 });
  const [opacity, setOpacity] = useState(80);
  const [scale, setScale] = useState(16);
  const [rotation, setRotation] = useState(0);
  const [marginPercent, setMarginPercent] = useState(3);
  const [format, setFormat] = useState<ExportImageFormat>('image/png');

  // Preview overlay & interaction
  const [showIndicator, setShowIndicator] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [watermarkBounds, setWatermarkBounds] = useState<{
    percentX: number;
    percentY: number;
    percentW: number;
    percentH: number;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Load the active source image
  useEffect(() => {
    if (!files.length || !files[activeFileIndex]) {
      setBaseImage(null);
      setWatermarkBounds(null);
      return;
    }

    let isSubscribed = true;
    readImage(files[activeFileIndex])
      .then((img) => {
        if (isSubscribed) setBaseImage(img);
      })
      .catch((err) => {
        if (isSubscribed) setError(err instanceof Error ? err.message : 'Cannot load image.');
      });

    return () => {
      isSubscribed = false;
    };
  }, [files, activeFileIndex]);

  // Handle Logo File Upload
  const handleLogoUpload = useCallback((file: File | null) => {
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreviewUrl(url);

    readImage(file)
      .then((img) => {
        setLogoImg(img);
        setLogoDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        if (mode === 'text') setMode('both');
      })
      .catch(() => {
        setError('Could not decode the uploaded watermark image.');
      });
  }, [mode]);

  const handleRemoveLogo = useCallback(() => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoFile(null);
    setLogoImg(null);
    setLogoDimensions(null);
    setLogoPreviewUrl('');
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (mode === 'image') setMode('text');
  }, [logoPreviewUrl, mode]);

  // Render live preview on canvas
  const renderLivePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Constrain preview display size while preserving aspect ratio
    const maxPreviewW = 1200;
    const maxPreviewH = 750;
    const scaleFactor = Math.min(1, maxPreviewW / baseImage.naturalWidth, maxPreviewH / baseImage.naturalHeight);
    const previewW = Math.round(baseImage.naturalWidth * scaleFactor);
    const previewH = Math.round(baseImage.naturalHeight * scaleFactor);

    if (canvas.width !== previewW || canvas.height !== previewH) {
      canvas.width = previewW;
      canvas.height = previewH;
    }

    ctx.clearRect(0, 0, previewW, previewH);
    ctx.drawImage(baseImage, 0, 0, previewW, previewH);

    const settings: WatermarkSettings = {
      mode,
      text,
      textColor,
      withPill,
      logoImg,
      position,
      customCoords,
      opacity,
      scale,
      rotation,
      marginPercent
    };

    drawWatermarkOnCanvas(ctx, previewW, previewH, settings);

    if (position === 'tile') {
      setWatermarkBounds(null);
    } else {
      const box = computeWatermarkBox(previewW, previewH, settings, ctx);
      if (box) {
        setWatermarkBounds({
          percentX: box.left / previewW,
          percentY: box.top / previewH,
          percentW: box.width / previewW,
          percentH: box.height / previewH
        });
      } else {
        setWatermarkBounds(null);
      }
    }
  }, [baseImage, mode, text, textColor, withPill, logoImg, position, customCoords, opacity, scale, rotation, marginPercent]);

  useEffect(() => {
    renderLivePreview();
  }, [renderLivePreview]);

  // Interactive Drag & Drop / Click on Stage to position watermark
  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current || !watermarkBounds || isDragging) return;
    const rect = stageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clampedX = Math.max(0, Math.min(1, (clickX - (rect.width * watermarkBounds.percentW) / 2) / (rect.width * (1 - watermarkBounds.percentW) || 1)));
    const clampedY = Math.max(0, Math.min(1, (clickY - (rect.height * watermarkBounds.percentH) / 2) / (rect.height * (1 - watermarkBounds.percentH) || 1)));

    setPosition('custom');
    setCustomCoords({ x: clampedX, y: clampedY });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (position === 'tile') return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: customCoords.x,
      startY: customCoords.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || !stageRef.current || !watermarkBounds) return;
    const rect = stageRef.current.getBoundingClientRect();

    const usableWidth = rect.width * (1 - watermarkBounds.percentW) || 1;
    const usableHeight = rect.height * (1 - watermarkBounds.percentH) || 1;

    const deltaX = (e.clientX - dragStartRef.current.clientX) / usableWidth;
    const deltaY = (e.clientY - dragStartRef.current.clientY) / usableHeight;

    const nextX = Math.max(0, Math.min(1, dragStartRef.current.startX + deltaX));
    const nextY = Math.max(0, Math.min(1, dragStartRef.current.startY + deltaY));

    setPosition('custom');
    setCustomCoords({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const getPositionLabel = (): string => {
    if (position === 'custom') {
      return `Custom (${Math.round(customCoords.x * 100)}%, ${Math.round(customCoords.y * 100)}%)`;
    }
    if (position === 'tile') return 'Tiled Pattern';
    const found = GRID_POSITIONS.find((p) => p.id === position);
    return found ? found.label : 'Bottom Right';
  };

  // Batch / Single Export
  const processAndDownload = async () => {
    if (!files.length) {
      setError('Please add at least one image.');
      return;
    }
    const hasText = (mode === 'text' || mode === 'both') && text.trim().length > 0;
    const hasLogo = (mode === 'image' || mode === 'both') && !!logoImg;

    if (!hasText && !hasLogo) {
      setError('Provide text or upload an image watermark before downloading.');
      return;
    }

    setBusy(true);
    setError('');
    setProgress({ current: 0, total: files.length });

    try {
      const outputs: { name: string; blob: Blob }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });
        const img = await readImage(file);

        if (img.naturalWidth * img.naturalHeight > 36_000_000) {
          throw new Error(`"${file.name}" exceeds the 36 megapixel browser safety limit.`);
        }

        const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable.');

        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        const settings: WatermarkSettings = {
          mode,
          text,
          textColor,
          withPill,
          logoImg,
          position,
          customCoords,
          opacity,
          scale,
          rotation,
          marginPercent
        };

        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, settings);

        const blob = await canvasBlob(canvas, format, 0.94);
        outputs.push({
          name: `${baseName(file.name)}-watermarked.${extensionFor(format)}`,
          blob
        });
      }

      if (outputs.length === 1) {
        downloadBlob(outputs[0].blob, outputs[0].name);
      } else {
        await downloadBatch(outputs, 'watermarked-images.zip');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermarking failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="extra-tool">
      <div className="extra-tool-heading">
        <Stamp size={24} />
        <div>
          <h2>Image Watermark Studio</h2>
          <p>
            Add live custom text or logo watermarks to your photos. Fully interactive placement with real-time preview — zero server uploads.
          </p>
        </div>
      </div>

      <div className="extra-layout">
        {/* Controls Panel */}
        <div className="extra-panel extra-controls">
          {/* Main Image Uploader */}
          <label className="extra-picker">
            <UploadCloud size={24} />
            <strong>Select photos to watermark</strong>
            <span>PNG, JPEG, WebP (up to 30 files)</span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const incoming = Array.from(e.target.files || []);
                if (incoming.length) {
                  setFiles(incoming.slice(0, 30));
                  setActiveFileIndex(0);
                  setError(incoming.length > 30 ? 'Limited to the first 30 files.' : '');
                }
                e.currentTarget.value = '';
              }}
            />
          </label>

          {files.length > 0 && (
            <div className="wm-batch-strip">
              {files.map((f, i) => (
                <button
                  key={`${f.name}-${i}`}
                  type="button"
                  className={`wm-thumb-btn ${i === activeFileIndex ? 'active' : ''}`}
                  onClick={() => setActiveFileIndex(i)}
                  title={`Preview image ${i + 1}: ${f.name}`}
                >
                  <span style={{ fontSize: '10px', color: '#aaa', padding: '2px 4px' }}>#{i + 1}</span>
                </button>
              ))}
            </div>
          )}

          {/* Watermark Mode Selection */}
          <div className="extra-field">
            <label>Watermark Type</label>
            <div className="tabs wm-mode-tabs">
              <button
                type="button"
                className={`tab-btn ${mode === 'text' ? 'active' : ''}`}
                onClick={() => setMode('text')}
              >
                <Type size={14} />
                <span>Text</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === 'image' ? 'active' : ''}`}
                onClick={() => setMode('image')}
              >
                <ImageIcon size={14} />
                <span>Logo</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === 'both' ? 'active' : ''}`}
                onClick={() => setMode('both')}
              >
                <Sparkles size={14} />
                <span>Logo + Text</span>
              </button>
            </div>
          </div>

          {/* Dedicated Button to Upload Image Watermark */}
          {(mode === 'image' || mode === 'both') && (
            <div className="wm-upload-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ margin: 0 }}>Watermark Logo / Image</label>
                {logoFile && (
                  <span style={{ fontSize: '11px', color: 'var(--orange-primary)' }}>
                    Active
                  </span>
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.currentTarget.value = '';
                }}
              />

              {!logoFile ? (
                <button
                  type="button"
                  className="btn btn-secondary wm-upload-action-btn"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <ImageIcon size={18} />
                  <span>Upload Watermark Image</span>
                </button>
              ) : (
                <div className="wm-logo-card">
                  <div className="wm-logo-thumb-wrap">
                    {logoPreviewUrl && (
                      <img src={logoPreviewUrl} alt="Watermark logo thumbnail" className="wm-logo-thumb" />
                    )}
                  </div>
                  <div className="wm-logo-meta">
                    <strong className="wm-logo-name" title={logoFile.name}>
                      {logoFile.name}
                    </strong>
                    <span className="wm-logo-dims">
                      {logoDimensions ? `${logoDimensions.w} × ${logoDimensions.h} px` : ''} · {formatBytes(logoFile.size)}
                    </span>
                  </div>
                  <div className="wm-logo-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      className="wm-btn-icon-danger"
                      onClick={handleRemoveLogo}
                      title="Remove watermark image"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text Watermark Controls */}
          {(mode === 'text' || mode === 'both') && (
            <div className="extra-field">
              <label htmlFor="wm-text-input">Watermark Text</label>
              <input
                id="wm-text-input"
                type="text"
                value={text}
                maxLength={80}
                placeholder="e.g. © MediaTools"
                onChange={(e) => setText(e.target.value)}
              />

              {/* Quick Preset Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                {TEXT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="extra-option"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => setText(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Color Presets */}
              <div style={{ marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Text Color:</span>
                <div className="wm-color-row" style={{ marginTop: '5px' }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      className={`wm-color-chip ${textColor === p.color ? 'active' : ''}`}
                      style={{ backgroundColor: p.color }}
                      onClick={() => setTextColor(p.color)}
                      title={p.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    title="Custom color"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={withPill}
                  onChange={(e) => setWithPill(e.target.checked)}
                />
                <span>Add contrast pill background</span>
              </label>
            </div>
          )}

          {/* Interactive Placement Controls */}
          <div className="extra-field wm-pos-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ margin: 0 }}>Watermark Placement</label>
              <span style={{ fontSize: '11px', color: 'var(--orange-primary)', fontWeight: 600 }}>
                {getPositionLabel()}
              </span>
            </div>

            {/* 3x3 Position Grid */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div className="wm-pos-grid">
                {GRID_POSITIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`wm-pos-btn ${position === p.id ? 'active' : ''}`}
                    onClick={() => {
                      setPosition(p.id);
                    }}
                    title={p.label}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${position === 'tile' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', minHeight: '38px', fontSize: '12px' }}
                  onClick={() => setPosition('tile')}
                >
                  <Grid size={14} />
                  <span>Tiled Pattern</span>
                </button>
                <small style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Tip: You can also click or drag directly on the preview image!
                </small>
              </div>
            </div>
          </div>

          {/* Adjustments: Scale, Opacity, Rotation, Margin */}
          <div className="extra-field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label htmlFor="wm-scale">Scale / Size</label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{scale}%</span>
            </div>
            <input
              id="wm-scale"
              type="range"
              min="4"
              max="45"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
          </div>

          <div className="extra-field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label htmlFor="wm-opacity">Opacity</label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{opacity}%</span>
            </div>
            <input
              id="wm-opacity"
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </div>

          <div className="extra-field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label htmlFor="wm-rotation">Rotation</label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rotation}°</span>
            </div>
            <input
              id="wm-rotation"
              type="range"
              min="-180"
              max="180"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button type="button" className="extra-option" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setRotation(0)}>0°</button>
              <button type="button" className="extra-option" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setRotation(-45)}>-45°</button>
              <button type="button" className="extra-option" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setRotation(45)}>45°</button>
              <button type="button" className="extra-option" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setRotation(90)}>90°</button>
            </div>
          </div>

          {position !== 'tile' && (
            <div className="extra-field">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label htmlFor="wm-margin">Edge Margin</label>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{marginPercent}%</span>
              </div>
              <input
                id="wm-margin"
                type="range"
                min="0"
                max="10"
                value={marginPercent}
                onChange={(e) => setMarginPercent(Number(e.target.value))}
              />
            </div>
          )}

          {/* Export Format */}
          <div className="extra-field">
            <label htmlFor="wm-format">Output Format</label>
            <select
              id="wm-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportImageFormat)}
            >
              <option value="image/png">PNG (Lossless, Transparency)</option>
              <option value="image/jpeg">JPEG (Compressed photo)</option>
              <option value="image/webp">WebP (Modern, Compact)</option>
            </select>
          </div>

          {/* Action Button */}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!files.length || busy}
            onClick={processAndDownload}
          >
            <Download size={17} />
            {busy
              ? progress
                ? `Watermarking ${progress.current}/${progress.total}…`
                : 'Applying watermark…'
              : files.length > 1
              ? `Apply & Download ZIP (${files.length} images)`
              : 'Apply & Download Watermarked Image'}
          </button>

          {error && <p className="extra-error" role="alert">{error}</p>}
        </div>

        {/* Live Preview Panel */}
        <div className="extra-panel extra-preview">
          {files.length > 0 && baseImage ? (
            <div className="wm-preview-wrapper">
              <div className="wm-preview-toolbar">
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Live Watermark Preview {files.length > 1 && `(${activeFileIndex + 1} of ${files.length})`}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ gap: '6px', fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => setShowIndicator((prev) => !prev)}
                >
                  {showIndicator ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showIndicator ? 'Hide Target Outline' : 'Show Target Outline'}</span>
                </button>
              </div>

              {/* Stage Container with Canvas and Interactive Placement Overlay */}
              <div
                ref={stageRef}
                className="wm-preview-stage"
                onClick={handleStageClick}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <canvas ref={canvasRef} className="wm-preview-canvas" />

                {/* Live Watermark Placement Box */}
                {showIndicator && watermarkBounds && position !== 'tile' && (
                  <div
                    className={`wm-placement-box ${isDragging ? 'dragging' : ''}`}
                    style={{
                      left: `${watermarkBounds.percentX * 100}%`,
                      top: `${watermarkBounds.percentY * 100}%`,
                      width: `${watermarkBounds.percentW * 100}%`,
                      height: `${watermarkBounds.percentH * 100}%`,
                      transform: `rotate(${rotation}deg)`
                    }}
                    onPointerDown={handlePointerDown}
                  >
                    <div className="wm-corner wm-tl" />
                    <div className="wm-corner wm-tr" />
                    <div className="wm-corner wm-bl" />
                    <div className="wm-corner wm-br" />
                    <div className="wm-placement-badge">
                      <Move size={11} />
                      <span>{getPositionLabel()}</span>
                    </div>
                  </div>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Watermark applied live. Drag the box or click on the image to fine-tune placement.
              </p>
            </div>
          ) : (
            <div className="extra-empty">
              <Stamp size={42} style={{ color: 'var(--orange-primary)', opacity: 0.6, margin: '0 auto 12px' }} />
              <strong>No photo selected</strong>
              <p style={{ marginTop: '6px' }}>
                Upload an image on the left to see the live watermark overlay and position controls.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
