'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  EyeOff,
  Download,
  UploadCloud,
  Sliders,
  Sparkles,
  RotateCcw,
  Trash2,
  Plus,
  Square,
  Circle,
  Split,
  Eye,
  ShieldCheck,
  Maximize,
  Grid
} from 'lucide-react';
import {
  baseName,
  canvasBlob,
  downloadBlob,
  extensionFor,
  readImage,
  type ExportImageFormat
} from '@/lib/additionalMedia';
import { formatFileSize } from '@/lib/utils';

export type BlurMode = 'full' | 'selective';
export type BlurStyle = 'gaussian' | 'pixelate' | 'radial';
export type CensorShape = 'rect' | 'ellipse';

export interface CensorBox {
  id: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  w: number; // percentage (0 - 100)
  h: number; // percentage (0 - 100)
  shape: CensorShape;
  style: 'gaussian' | 'pixelate';
  intensity: number; // radius or pixel size
}

const FORMATS: { label: string; value: ExportImageFormat }[] = [
  { label: 'PNG (Lossless)', value: 'image/png' },
  { label: 'WebP (Modern)', value: 'image/webp' },
  { label: 'JPEG (Standard)', value: 'image/jpeg' },
];

export function ImageBlurTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Mode & General settings
  const [mode, setMode] = useState<BlurMode>('selective');
  const [blurStyle, setBlurStyle] = useState<BlurStyle>('gaussian');
  const [blurRadius, setBlurRadius] = useState<number>(20); // 1 - 100 px
  const [pixelSize, setPixelSize] = useState<number>(18); // 4 - 64 px
  const [radialCenter, setRadialCenter] = useState<{ x: number; y: number }>({ x: 50, y: 50 }); // %
  const [radialRadius, setRadialRadius] = useState<number>(35); // % of image

  // Selective Censor Boxes (coordinates in percentage 0..100)
  const [boxes, setBoxes] = useState<CensorBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [invertSelective, setInvertSelective] = useState<boolean>(false); // Bokeh / Portrait mode
  const [defaultShape, setDefaultShape] = useState<CensorShape>('rect');
  const [defaultCensorStyle, setDefaultCensorStyle] = useState<'gaussian' | 'pixelate'>('pixelate');

  // Export settings
  const [format, setFormat] = useState<ExportImageFormat>('image/png');
  const [quality, setQuality] = useState<number>(0.92);

  // Preview & Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [compareMode, setCompareMode] = useState<'processed' | 'original' | 'split'>('processed');
  const [splitPos, setSplitPos] = useState<number>(50);

  // References
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dragging state for censor box or split slider
  const dragRef = useRef<{
    active: boolean;
    type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'create' | 'split' | 'radial';
    boxId?: string;
    startX: number;
    startY: number;
    initialBox?: { x: number; y: number; w: number; h: number };
  }>({ active: false, type: 'move', startX: 0, startY: 0 });

  // Handle image load
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP, etc.).');
      return;
    }
    setFile(f);
    setError('');

    readImage(f)
      .then((img) => {
        setImgElement(img);
        setDimensions({ w: img.naturalWidth, h: img.naturalHeight });

        // Add a default censor box in center for easy discoverability in selective mode
        const defaultBox: CensorBox = {
          id: 'box_' + Date.now(),
          x: 35,
          y: 30,
          w: 30,
          h: 25,
          shape: 'rect',
          style: 'pixelate',
          intensity: 16,
        };
        setBoxes([defaultBox]);
        setSelectedBoxId(defaultBox.id);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load image.');
      });
  }, []);

  // Add a new censor box
  const addCensorBox = () => {
    const newBox: CensorBox = {
      id: 'box_' + Date.now(),
      x: 30 + (boxes.length % 5) * 4,
      y: 30 + (boxes.length % 5) * 4,
      w: 25,
      h: 20,
      shape: defaultShape,
      style: defaultCensorStyle,
      intensity: defaultCensorStyle === 'pixelate' ? pixelSize : blurRadius,
    };
    setBoxes((prev) => [...prev, newBox]);
    setSelectedBoxId(newBox.id);
  };

  // Delete selected box
  const deleteSelectedBox = () => {
    if (!selectedBoxId) return;
    setBoxes((prev) => prev.filter((b) => b.id !== selectedBoxId));
    setSelectedBoxId(null);
  };

  // Clear all boxes
  const clearAllBoxes = () => {
    setBoxes([]);
    setSelectedBoxId(null);
  };

  // Render Full Image Blur on an existing canvas
  const renderFullBlur = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) => {
    if (blurStyle === 'gaussian') {
      // Draw background sharp first to prevent transparent edge seams, then draw blurred over
      ctx.drawImage(img, 0, 0, width, height);

      // Clamp blur relative to image resolution
      const scaleFactor = Math.max(width, height) / 800;
      const effectiveRadius = Math.max(1, Math.round(blurRadius * Math.max(1, scaleFactor * 0.6)));

      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.filter = `blur(${effectiveRadius}px)`;
        // draw slightly expanded to prevent transparent perimeter
        const margin = effectiveRadius * 2;
        offCtx.drawImage(img, -margin, -margin, width + margin * 2, height + margin * 2);
        ctx.drawImage(offCanvas, 0, 0, width, height);
      }
    } else if (blurStyle === 'pixelate') {
      const scaleFactor = Math.max(width, height) / 800;
      const effectivePixelSize = Math.max(2, Math.round(pixelSize * Math.max(1, scaleFactor * 0.7)));

      const downW = Math.max(1, Math.ceil(width / effectivePixelSize));
      const downH = Math.max(1, Math.ceil(height / effectivePixelSize));

      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = downW;
      smallCanvas.height = downH;
      const smallCtx = smallCanvas.getContext('2d');

      if (smallCtx) {
        smallCtx.imageSmoothingEnabled = false;
        smallCtx.drawImage(img, 0, 0, downW, downH);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(smallCanvas, 0, 0, downW, downH, 0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
      }
    } else if (blurStyle === 'radial') {
      // Vignette / Bokeh focus
      // 1. Draw blurred version to offscreen
      const scaleFactor = Math.max(width, height) / 800;
      const effectiveRadius = Math.max(1, Math.round(blurRadius * Math.max(1, scaleFactor * 0.6)));

      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = width;
      blurCanvas.height = height;
      const blurCtx = blurCanvas.getContext('2d');
      if (blurCtx) {
        blurCtx.filter = `blur(${effectiveRadius}px)`;
        const margin = effectiveRadius * 2;
        blurCtx.drawImage(img, -margin, -margin, width + margin * 2, height + margin * 2);
      }

      // 2. Draw sharp image first
      ctx.drawImage(img, 0, 0, width, height);

      // 3. Composite blurred version with radial alpha gradient mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx && blurCtx) {
        const cx = (radialCenter.x / 100) * width;
        const cy = (radialCenter.y / 100) * height;
        const maxDim = Math.max(width, height);
        const innerR = (radialRadius / 100) * maxDim * 0.4;
        const outerR = (radialRadius / 100) * maxDim;

        const grad = maskCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,1)');

        maskCtx.drawImage(blurCanvas, 0, 0);
        maskCtx.globalCompositeOperation = 'destination-in';
        maskCtx.fillStyle = grad;
        maskCtx.fillRect(0, 0, width, height);

        ctx.drawImage(maskCanvas, 0, 0);
      }
    }
  };

  // Render Selective Censor Blur
  const renderSelectiveBlur = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) => {
    const scaleFactor = Math.max(width, height) / 800;

    if (invertSelective) {
      // Invert: Bokeh / Portrait mode
      // Everything is blurred except inside the selected boxes!
      renderFullBlur(ctx, img, width, height);

      // Now restore sharp original inside each box
      boxes.forEach((box) => {
        const bx = (box.x / 100) * width;
        const by = (box.y / 100) * height;
        const bw = (box.w / 100) * width;
        const bh = (box.h / 100) * height;

        ctx.save();
        ctx.beginPath();
        if (box.shape === 'ellipse') {
          ctx.ellipse(bx + bw / 2, by + bh / 2, Math.abs(bw / 2), Math.abs(bh / 2), 0, 0, Math.PI * 2);
        } else {
          ctx.rect(bx, by, bw, bh);
        }
        ctx.clip();
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
      });
      return;
    }

    // Normal Censor Mode: Draw sharp image first
    ctx.drawImage(img, 0, 0, width, height);

    // Apply censor blur or pixelate to each box
    boxes.forEach((box) => {
      const bx = (box.x / 100) * width;
      const by = (box.y / 100) * height;
      const bw = (box.w / 100) * width;
      const bh = (box.h / 100) * height;

      if (bw <= 0 || bh <= 0) return;

      ctx.save();
      ctx.beginPath();
      if (box.shape === 'ellipse') {
        ctx.ellipse(bx + bw / 2, by + bh / 2, Math.abs(bw / 2), Math.abs(bh / 2), 0, 0, Math.PI * 2);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.clip();

      if (box.style === 'pixelate') {
        const effectivePixelSize = Math.max(3, Math.round(box.intensity * Math.max(1, scaleFactor * 0.7)));
        const smallW = Math.max(1, Math.ceil(bw / effectivePixelSize));
        const smallH = Math.max(1, Math.ceil(bh / effectivePixelSize));

        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = smallW;
        smallCanvas.height = smallH;
        const sCtx = smallCanvas.getContext('2d');
        if (sCtx) {
          sCtx.imageSmoothingEnabled = false;
          sCtx.drawImage(img, bx, by, bw, bh, 0, 0, smallW, smallH);

          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(smallCanvas, 0, 0, smallW, smallH, bx, by, bw, bh);
          ctx.imageSmoothingEnabled = true;
        }
      } else {
        // Gaussian blur in censor box
        const effectiveRadius = Math.max(2, Math.round(box.intensity * Math.max(1, scaleFactor * 0.6)));
        const boxCanvas = document.createElement('canvas');
        boxCanvas.width = bw;
        boxCanvas.height = bh;
        const bCtx = boxCanvas.getContext('2d');
        if (bCtx) {
          bCtx.filter = `blur(${effectiveRadius}px)`;
          const pad = effectiveRadius * 2;
          bCtx.drawImage(img, bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 0, 0, bw, bh);
          ctx.drawImage(boxCanvas, bx, by);
        }
      }

      ctx.restore();
    });
  };

  // Update preview canvas whenever settings change
  useEffect(() => {
    if (!imgElement || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use responsive display resolution for snappy interactive feedback (max 1600px width/height)
    const maxDim = 1600;
    let targetW = imgElement.naturalWidth;
    let targetH = imgElement.naturalHeight;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.clearRect(0, 0, targetW, targetH);

    if (mode === 'full') {
      renderFullBlur(ctx, imgElement, targetW, targetH);
    } else {
      renderSelectiveBlur(ctx, imgElement, targetW, targetH);
    }
  }, [
    imgElement,
    mode,
    blurStyle,
    blurRadius,
    pixelSize,
    radialCenter,
    radialRadius,
    boxes,
    invertSelective,
  ]);

  // Export full resolution image
  const handleDownload = async () => {
    if (!imgElement || !file) return;

    setIsProcessing(true);
    setError('');

    try {
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = imgElement.naturalWidth;
      fullCanvas.height = imgElement.naturalHeight;
      const ctx = fullCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context.');

      if (mode === 'full') {
        renderFullBlur(ctx, imgElement, fullCanvas.width, fullCanvas.height);
      } else {
        renderSelectiveBlur(ctx, imgElement, fullCanvas.width, fullCanvas.height);
      }

      const blob = await canvasBlob(fullCanvas, format, quality);
      const ext = extensionFor(format);
      const base = baseName(file.name);
      downloadBlob(blob, `${base}_blurred.${ext}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Presets
  const applyPreset = (presetName: string) => {
    if (presetName === 'face-censor') {
      setMode('selective');
      setDefaultCensorStyle('pixelate');
      setDefaultShape('rect');
      setPixelSize(18);
      setInvertSelective(false);
      if (boxes.length === 0) addCensorBox();
    } else if (presetName === 'license-plate') {
      setMode('selective');
      setDefaultCensorStyle('gaussian');
      setDefaultShape('rect');
      setBlurRadius(28);
      setInvertSelective(false);
      if (boxes.length === 0) addCensorBox();
    } else if (presetName === 'portrait') {
      setMode('selective');
      setInvertSelective(true);
      setDefaultShape('ellipse');
      setBlurRadius(24);
      if (boxes.length === 0) {
        const box: CensorBox = {
          id: 'box_' + Date.now(),
          x: 25,
          y: 15,
          w: 50,
          h: 70,
          shape: 'ellipse',
          style: 'gaussian',
          intensity: 24,
        };
        setBoxes([box]);
        setSelectedBoxId(box.id);
      }
    } else if (presetName === 'full-soft') {
      setMode('full');
      setBlurStyle('gaussian');
      setBlurRadius(15);
    } else if (presetName === 'full-heavy') {
      setMode('full');
      setBlurStyle('gaussian');
      setBlurRadius(45);
    } else if (presetName === 'mosaic-art') {
      setMode('full');
      setBlurStyle('pixelate');
      setPixelSize(22);
    }
  };

  // Pointer event handlers for moving and resizing boxes
  const handlePointerDownContainer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    // If split compare mode active and clicking near split
    if (compareMode === 'split') {
      dragRef.current = {
        active: true,
        type: 'split',
        startX: e.clientX,
        startY: e.clientY,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (mode === 'full' && blurStyle === 'radial') {
      setRadialCenter({ x: Math.round(xPct), y: Math.round(yPct) });
      dragRef.current = {
        active: true,
        type: 'radial',
        startX: e.clientX,
        startY: e.clientY,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (mode !== 'selective') return;

    // Check if clicked inside an existing box (from top to bottom)
    let clickedBox: CensorBox | undefined;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (xPct >= b.x && xPct <= b.x + b.w && yPct >= b.y && yPct <= b.y + b.h) {
        clickedBox = b;
        break;
      }
    }

    if (clickedBox) {
      setSelectedBoxId(clickedBox.id);
      dragRef.current = {
        active: true,
        type: 'move',
        boxId: clickedBox.id,
        startX: xPct,
        startY: yPct,
        initialBox: { ...clickedBox },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      // Clicked outside: create new box by dragging!
      const newBoxId = 'box_' + Date.now();
      const newBox: CensorBox = {
        id: newBoxId,
        x: Math.round(xPct),
        y: Math.round(yPct),
        w: 1,
        h: 1,
        shape: defaultShape,
        style: defaultCensorStyle,
        intensity: defaultCensorStyle === 'pixelate' ? pixelSize : blurRadius,
      };
      setBoxes((prev) => [...prev, newBox]);
      setSelectedBoxId(newBoxId);
      dragRef.current = {
        active: true,
        type: 'create',
        boxId: newBoxId,
        startX: xPct,
        startY: yPct,
        initialBox: { ...newBox },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerDownHandle = (
    e: React.PointerEvent<HTMLDivElement>,
    box: CensorBox,
    handleType: 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    e.stopPropagation();
    if (!previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    setSelectedBoxId(box.id);
    dragRef.current = {
      active: true,
      type: handleType,
      boxId: box.id,
      startX: xPct,
      startY: yPct,
      initialBox: { ...box },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !previewContainerRef.current) return;

    const rect = previewContainerRef.current.getBoundingClientRect();
    const currentXPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const currentYPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (dragRef.current.type === 'split') {
      setSplitPos(currentXPct);
      return;
    }

    if (dragRef.current.type === 'radial') {
      setRadialCenter({ x: Math.round(currentXPct), y: Math.round(currentYPct) });
      return;
    }

    const { boxId, type, startX, startY, initialBox } = dragRef.current;
    if (!boxId || !initialBox) return;

    const dx = currentXPct - startX;
    const dy = currentYPct - startY;

    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== boxId) return b;

        if (type === 'move') {
          const newX = Math.max(0, Math.min(100 - initialBox.w, initialBox.x + dx));
          const newY = Math.max(0, Math.min(100 - initialBox.h, initialBox.y + dy));
          return { ...b, x: Math.round(newX), y: Math.round(newY) };
        }

        if (type === 'create') {
          const x = Math.min(startX, currentXPct);
          const y = Math.min(startY, currentYPct);
          const w = Math.max(2, Math.abs(currentXPct - startX));
          const h = Math.max(2, Math.abs(currentYPct - startY));
          return { ...b, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
        }

        if (type === 'se') {
          const w = Math.max(3, Math.min(100 - initialBox.x, initialBox.w + dx));
          const h = Math.max(3, Math.min(100 - initialBox.y, initialBox.h + dy));
          return { ...b, w: Math.round(w), h: Math.round(h) };
        }

        if (type === 'nw') {
          const newX = Math.max(0, Math.min(initialBox.x + initialBox.w - 3, initialBox.x + dx));
          const newY = Math.max(0, Math.min(initialBox.y + initialBox.h - 3, initialBox.y + dy));
          const newW = initialBox.w + (initialBox.x - newX);
          const newH = initialBox.h + (initialBox.y - newY);
          return { ...b, x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) };
        }

        if (type === 'ne') {
          const newY = Math.max(0, Math.min(initialBox.y + initialBox.h - 3, initialBox.y + dy));
          const newW = Math.max(3, Math.min(100 - initialBox.x, initialBox.w + dx));
          const newH = initialBox.h + (initialBox.y - newY);
          return { ...b, y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) };
        }

        if (type === 'sw') {
          const newX = Math.max(0, Math.min(initialBox.x + initialBox.w - 3, initialBox.x + dx));
          const newW = initialBox.w + (initialBox.x - newX);
          const newH = Math.max(3, Math.min(100 - initialBox.y, initialBox.h + dy));
          return { ...b, x: Math.round(newX), w: Math.round(newW), h: Math.round(newH) };
        }

        return b;
      })
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

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
            <EyeOff size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Image Blur & Privacy Censor
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Blur full images or censor sensitive areas (faces, license plates, credit cards, confidential info) with Gaussian blur or pixelate mosaic.
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
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Choose an image to blur</strong>
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
                  setBoxes([]);
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Quick Presets
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '7px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => applyPreset('face-censor')}
              >
                <Grid size={13} style={{ color: 'var(--orange-primary)' }} />
                <span>Face Censor</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '7px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => applyPreset('license-plate')}
              >
                <ShieldCheck size={13} style={{ color: 'var(--orange-primary)' }} />
                <span>License / ID</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '7px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => applyPreset('portrait')}
              >
                <Sparkles size={13} style={{ color: 'var(--orange-primary)' }} />
                <span>Portrait Bokeh</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '7px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => applyPreset('full-soft')}
              >
                <Sliders size={13} style={{ color: 'var(--orange-primary)' }} />
                <span>Full Soft Blur</span>
              </button>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Blur Scope
            </label>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              <button
                type="button"
                className={`extra-option ${mode === 'selective' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px', border: 'none' }}
                onClick={() => setMode('selective')}
              >
                Selective Censor
              </button>
              <button
                type="button"
                className={`extra-option ${mode === 'full' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px', border: 'none' }}
                onClick={() => setMode('full')}
              >
                Full Image Blur
              </button>
            </div>
          </div>

          {/* Mode-specific Controls */}
          {mode === 'selective' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Censor Masks ({boxes.length})
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={addCensorBox}
                    title="Add a new censor mask"
                  >
                    <Plus size={12} /> Add Mask
                  </button>
                  {boxes.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', color: '#ff6b6b' }}
                      onClick={clearAllBoxes}
                      title="Clear all censor masks"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Invert toggle (Bokeh / Portrait) */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <input
                  type="checkbox"
                  checked={invertSelective}
                  onChange={(e) => setInvertSelective(e.target.checked)}
                />
                <span>Invert: Blur background & keep subject sharp (Portrait)</span>
              </label>

              {/* Selected Box Config */}
              {selectedBox ? (
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-charcoal)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--orange-primary)' }}>
                      Selected Mask #{boxes.findIndex((b) => b.id === selectedBox.id) + 1}
                    </span>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ff6b6b',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                      onClick={deleteSelectedBox}
                      title="Delete this mask"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Mask Style & Shape */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Type
                      </label>
                      <select
                        style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px' }}
                        value={selectedBox.style}
                        onChange={(e) => {
                          const val = e.target.value as 'gaussian' | 'pixelate';
                          setBoxes((prev) =>
                            prev.map((b) => (b.id === selectedBox.id ? { ...b, style: val } : b))
                          );
                          setDefaultCensorStyle(val);
                        }}
                      >
                        <option value="pixelate">Pixelate (Mosaic)</option>
                        <option value="gaussian">Gaussian Blur</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Shape
                      </label>
                      <select
                        style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px' }}
                        value={selectedBox.shape}
                        onChange={(e) => {
                          const val = e.target.value as CensorShape;
                          setBoxes((prev) =>
                            prev.map((b) => (b.id === selectedBox.id ? { ...b, shape: val } : b))
                          );
                          setDefaultShape(val);
                        }}
                      >
                        <option value="rect">Rectangle</option>
                        <option value="ellipse">Circle / Ellipse</option>
                      </select>
                    </div>
                  </div>

                  {/* Intensity slider for selected box */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {selectedBox.style === 'pixelate' ? 'Block Size (Mosaic)' : 'Blur Radius'}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {selectedBox.intensity}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={selectedBox.style === 'pixelate' ? 4 : 2}
                      max={selectedBox.style === 'pixelate' ? 48 : 60}
                      value={selectedBox.intensity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setBoxes((prev) =>
                          prev.map((b) => (b.id === selectedBox.id ? { ...b, intensity: val } : b))
                        );
                        if (selectedBox.style === 'pixelate') setPixelSize(val);
                        else setBlurRadius(val);
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  💡 Tip: Click & drag on the preview image to draw censor masks over faces or sensitive text.
                </p>
              )}
            </div>
          ) : (
            /* Full Blur Controls */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Blur Effect Style
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <button
                    type="button"
                    className={`extra-option ${blurStyle === 'gaussian' ? 'selected' : ''}`}
                    style={{ fontSize: '11px', padding: '6px 4px' }}
                    onClick={() => setBlurStyle('gaussian')}
                  >
                    Gaussian
                  </button>
                  <button
                    type="button"
                    className={`extra-option ${blurStyle === 'pixelate' ? 'selected' : ''}`}
                    style={{ fontSize: '11px', padding: '6px 4px' }}
                    onClick={() => setBlurStyle('pixelate')}
                  >
                    Pixelate
                  </button>
                  <button
                    type="button"
                    className={`extra-option ${blurStyle === 'radial' ? 'selected' : ''}`}
                    style={{ fontSize: '11px', padding: '6px 4px' }}
                    onClick={() => setBlurStyle('radial')}
                  >
                    Radial Vignette
                  </button>
                </div>
              </div>

              {blurStyle === 'gaussian' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Blur Intensity</span>
                    <span style={{ color: 'var(--orange-primary)', fontWeight: 600 }}>{blurRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="80"
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {blurStyle === 'pixelate' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mosaic Block Size</span>
                    <span style={{ color: 'var(--orange-primary)', fontWeight: 600 }}>{pixelSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="64"
                    value={pixelSize}
                    onChange={(e) => setPixelSize(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {blurStyle === 'radial' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Focus Radius</span>
                      <span style={{ color: 'var(--orange-primary)', fontWeight: 600 }}>{radialRadius}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="80"
                      value={radialRadius}
                      onChange={(e) => setRadialRadius(parseInt(e.target.value, 10))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Outer Blur Amount</span>
                      <span style={{ color: 'var(--orange-primary)', fontWeight: 600 }}>{blurRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="70"
                      value={blurRadius}
                      onChange={(e) => setBlurRadius(parseInt(e.target.value, 10))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    💡 Tap anywhere on the preview to place the sharp focal point.
                  </p>
                </div>
              )}
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

              {format !== 'image/png' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Quality</span>
                    <span style={{ color: 'var(--text-primary)' }}>{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              )}
            </div>

            {/* Download Button */}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!file || !imgElement || isProcessing}
              onClick={handleDownload}
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
              <Download size={16} />
              {isProcessing ? 'Processing Full Res…' : 'Download Blurred Image'}
            </button>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: '12px', margin: 0, textAlign: 'center' }}>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Canvas Preview */}
        <div
          className="extra-panel extra-preview"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-charcoal)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minHeight: '480px',
          }}
        >
          {/* Preview Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              borderBottom: '1px solid var(--border-charcoal)',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Live Canvas
              </span>
              {dimensions.w > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {dimensions.w} × {dimensions.h} px
                </span>
              )}
            </div>

            {/* Compare Selector */}
            {file && (
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'var(--bg-tertiary)',
                  padding: '3px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <button
                  type="button"
                  className={`btn ${compareMode === 'processed' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setCompareMode('processed')}
                >
                  <Eye size={12} style={{ marginRight: '4px' }} /> Result
                </button>
                <button
                  type="button"
                  className={`btn ${compareMode === 'split' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setCompareMode('split')}
                >
                  <Split size={12} style={{ marginRight: '4px' }} /> Split View
                </button>
                <button
                  type="button"
                  className={`btn ${compareMode === 'original' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setCompareMode('original')}
                >
                  Original
                </button>
              </div>
            )}
          </div>

          {/* Canvas Display Viewport */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              minHeight: '380px',
              background: '#0e0e0e',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {!file ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                <EyeOff size={44} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Upload an image to start blurring and censoring.</p>
              </div>
            ) : (
              <div
                ref={previewContainerRef}
                onPointerDown={handlePointerDownContainer}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  maxWidth: '100%',
                  maxHeight: '600px',
                  cursor: mode === 'selective' ? 'crosshair' : 'default',
                  touchAction: 'none',
                }}
              >
                {/* 1. Underlying Original Image (Used for Split Compare or Original View) */}
                <img
                  src={file ? URL.createObjectURL(file) : ''}
                  alt="Original"
                  style={{
                    display: compareMode === 'original' ? 'block' : 'none',
                    maxWidth: '100%',
                    maxHeight: '600px',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                />

                {/* 2. Processed Canvas */}
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    display: compareMode === 'original' ? 'none' : 'block',
                    maxWidth: '100%',
                    maxHeight: '600px',
                    objectFit: 'contain',
                    clipPath:
                      compareMode === 'split' ? `inset(0 ${100 - splitPos}% 0 0)` : 'none',
                  }}
                />

                {/* 3. Original underlay when in split mode */}
                {compareMode === 'split' && file && (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Original Underlay"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      clipPath: `inset(0 0 0 ${splitPos}%)`,
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Split line handle */}
                {compareMode === 'split' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${splitPos}%`,
                      width: '2px',
                      background: 'var(--orange-primary)',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--orange-primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      }}
                    >
                      <Split size={14} />
                    </div>
                  </div>
                )}

                {/* Radial focus marker when in radial blur mode */}
                {mode === 'full' && blurStyle === 'radial' && compareMode === 'processed' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${radialCenter.y}%`,
                      left: `${radialCenter.x}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '2px solid #fff',
                      background: 'rgba(255, 90, 9, 0.4)',
                      boxShadow: '0 0 10px rgba(0,0,0,0.8)',
                      pointerEvents: 'none',
                      zIndex: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                  </div>
                )}

                {/* 4. Selective Censor Interactive Overlays */}
                {mode === 'selective' &&
                  compareMode === 'processed' &&
                  boxes.map((box, idx) => {
                    const isSelected = box.id === selectedBoxId;
                    return (
                      <div
                        key={box.id}
                        style={{
                          position: 'absolute',
                          top: `${box.y}%`,
                          left: `${box.x}%`,
                          width: `${box.w}%`,
                          height: `${box.h}%`,
                          border: isSelected
                            ? '2px solid var(--orange-primary)'
                            : '1.5px dashed rgba(255, 255, 255, 0.7)',
                          borderRadius: box.shape === 'ellipse' ? '50%' : '2px',
                          boxShadow: isSelected ? '0 0 8px rgba(255, 90, 9, 0.6)' : 'none',
                          boxSizing: 'border-box',
                          zIndex: isSelected ? 6 : 4,
                          cursor: 'move',
                          touchAction: 'none',
                        }}
                      >
                        {/* Number badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '-20px',
                            left: '0',
                            background: isSelected ? 'var(--orange-primary)' : 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            pointerEvents: 'none',
                          }}
                        >
                          #{idx + 1} {box.shape === 'ellipse' ? '○' : '□'}
                        </div>

                        {/* Resize Handles (Corner points) when selected */}
                        {isSelected && (
                          <>
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'nw')}
                              style={{
                                position: 'absolute',
                                top: '-5px',
                                left: '-5px',
                                width: '10px',
                                height: '10px',
                                background: '#fff',
                                border: '1.5px solid var(--orange-primary)',
                                borderRadius: '2px',
                                cursor: 'nw-resize',
                                zIndex: 7,
                              }}
                            />
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'ne')}
                              style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                width: '10px',
                                height: '10px',
                                background: '#fff',
                                border: '1.5px solid var(--orange-primary)',
                                borderRadius: '2px',
                                cursor: 'ne-resize',
                                zIndex: 7,
                              }}
                            />
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'se')}
                              style={{
                                position: 'absolute',
                                bottom: '-5px',
                                right: '-5px',
                                width: '10px',
                                height: '10px',
                                background: '#fff',
                                border: '1.5px solid var(--orange-primary)',
                                borderRadius: '2px',
                                cursor: 'se-resize',
                                zIndex: 7,
                              }}
                            />
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'sw')}
                              style={{
                                position: 'absolute',
                                bottom: '-5px',
                                left: '-5px',
                                width: '10px',
                                height: '10px',
                                background: '#fff',
                                border: '1.5px solid var(--orange-primary)',
                                borderRadius: '2px',
                                cursor: 'sw-resize',
                                zIndex: 7,
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Quick instructions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              paddingTop: '6px',
            }}
          >
            <span>🔒 All processing is done 100% locally in your browser.</span>
            <span>Zero server data transfer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
