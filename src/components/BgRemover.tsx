'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Eraser, UploadCloud, Download, X, RefreshCw, Cpu, CheckCircle,
  Sparkles, Sliders, Image as ImageIcon, Video, Layers, Eye,
  Play, Pause, Zap, Check, ChevronDown, ChevronUp, Palette, Grid, Monitor
} from 'lucide-react';
import { formatFileSize, formatTime } from '@/lib/utils';
import {
  removeImageBackground,
  checkWebGPUSupport,
  BgRemovalModel,
  BgRemovalDevice
} from '@/lib/bgRemovalEngine';
import { extractFramesGenerator, getVideoMetadata, ExtractedFrame } from '@/lib/videoUtils';
import { downloadFramesAsZip } from '@/lib/zipUtils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type ExportFormat = 'image/png' | 'image/webp';
type AppTab = 'image' | 'video';
type BackdropStyle = 'checker' | 'white' | 'black' | 'green' | 'custom' | 'blur';

interface BatchImageItem {
  id: string;
  file: File;
  previewUrl: string;
  resultUrl: string | null;
  resultBlob: Blob | null;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  timeMs?: number;
  deviceUsed?: string;
}

export function BgRemover() {
  const [activeTab, setActiveTab] = useState<AppTab>('image');
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);

  // Settings
  const [model, setModel] = useState<BgRemovalModel>('isnet'); // Ultra Quality by default
  const [device, setDevice] = useState<BgRemovalDevice>('gpu');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('image/png');
  const [maxDimension, setMaxDimension] = useState<number>(0); // 0 = original
  const [refineEdges, setRefineEdges] = useState<boolean>(true);
  const [featherRadius, setFeatherRadius] = useState<number>(1);
  const [thresholdCutoff, setThresholdCutoff] = useState<number>(12);
  const [deFringe, setDeFringe] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Preview & Backdrop
  const [backdrop, setBackdrop] = useState<BackdropStyle>('checker');
  const [customColor, setCustomColor] = useState<string>('#3b82f6');
  const [sliderPosition, setSliderPosition] = useState<number>(50); // Split slider 0-100%
  const [isComparing, setIsComparing] = useState<boolean>(true);

  // Single / Batch Images State
  const [images, setImages] = useState<BatchImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Video Mode State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoInterval, setVideoInterval] = useState<number>(1); // every N seconds
  const [maxVideoFrames, setMaxVideoFrames] = useState<number>(20);
  const [videoFrames, setVideoFrames] = useState<ExtractedFrame[]>([]);
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatusMsg, setVideoStatusMsg] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const compareContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSliderRef = useRef(false);

  // Detect WebGPU on mount
  useEffect(() => {
    checkWebGPUSupport().then((supported) => {
      setHasWebGPU(supported);
      if (!supported) setDevice('cpu');
    });
  }, []);

  // Revoke URLs on cleanup
  useEffect(() => {
    return () => {
      images.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
      videoFrames.forEach((frame) => {
        if (frame.previewUrl) URL.revokeObjectURL(frame.previewUrl);
      });
    };
  }, []);

  // Handle files selection
  const handleImageFiles = useCallback((fileList: FileList | File[]) => {
    const valid = ['image/jpeg', 'image/png', 'image/webp'];
    const newItems: BatchImageItem[] = [];

    Array.from(fileList).forEach((file) => {
      if (valid.includes(file.type)) {
        newItems.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          resultUrl: null,
          resultBlob: null,
          status: 'idle',
          progress: 0,
        });
      }
    });

    if (newItems.length === 0) {
      alert('Please upload JPEG, PNG, or WebP images.');
      return;
    }

    setImages((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) setSelectedIndex(0);
      return updated;
    });
  }, []);

  // Handle Video Selection
  const handleVideoFile = useCallback(async (file: File) => {
    const valid = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!valid.includes(file.type)) {
      alert('Please upload a valid MP4, WebM, or MOV video.');
      return;
    }

    try {
      const meta = await getVideoMetadata(file);
      setVideoFile(file);
      setVideoDuration(meta.duration);
      setVideoFrames([]);
      setVideoProgress(0);
      setVideoStatusMsg('');
    } catch (err) {
      alert('Failed to read video file.');
    }
  }, []);

  // Drop handlers
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      if (activeTab === 'image') {
        handleImageFiles(droppedFiles);
      } else {
        handleVideoFile(droppedFiles[0]);
      }
    },
    [activeTab, handleImageFiles, handleVideoFile]
  );

  // Run AI Background Removal on Images
  const processImages = async () => {
    if (images.length === 0) return;
    setIsProcessingImages(true);
    setStatusMsg('Initializing hardware-accelerated pipeline…');

    const total = images.length;
    for (let i = 0; i < total; i++) {
      const item = images[i];
      if (item.status === 'done' && item.resultUrl) continue; // Skip already finished

      setSelectedIndex(i);
      setImages((prev) =>
        prev.map((img, idx) => (idx === i ? { ...img, status: 'processing', progress: 10 } : img))
      );

      try {
        const res = await removeImageBackground(item.file, {
          model,
          device,
          format: exportFormat,
          quality: exportFormat === 'image/webp' ? 0.95 : 1,
          maxDimension,
          refineEdges,
          refinement: {
            featherRadius,
            thresholdCutoff,
            deFringe,
          },
          onProgress: (pct, stage) => {
            setImages((prev) =>
              prev.map((img, idx) => (idx === i ? { ...img, progress: pct } : img))
            );
            setStatusMsg(`[${i + 1}/${total}] ${stage}`);
            setGlobalProgress(Math.round(((i + pct / 100) / total) * 100));
          },
        });

        const url = URL.createObjectURL(res.blob);
        setImages((prev) =>
          prev.map((img, idx) =>
            idx === i
              ? {
                  ...img,
                  status: 'done',
                  progress: 100,
                  resultUrl: url,
                  resultBlob: res.blob,
                  timeMs: res.timeMs,
                  deviceUsed: res.deviceUsed,
                }
              : img
          )
        );
      } catch (err) {
        console.error('Failed on image:', item.file.name, err);
        setImages((prev) =>
          prev.map((img, idx) =>
            idx === i ? { ...img, status: 'error', progress: 0 } : img
          )
        );
      }
    }

    setIsProcessingImages(false);
    setStatusMsg('All images processed successfully!');
    setGlobalProgress(100);
  };

  // Run AI Video Background Removal
  const processVideo = async () => {
    if (!videoFile) return;
    setIsExtractingVideo(true);
    setVideoFrames([]);
    setVideoProgress(0);
    setVideoStatusMsg('Initializing video decoding and WebGPU neural model…');

    try {
      const stepSeconds = Math.max(0.2, videoInterval);
      const estFrames = Math.min(maxVideoFrames, Math.ceil(videoDuration / stepSeconds));

      const generator = extractFramesGenerator(videoFile, {
        startTime: 0,
        endTime: Math.min(videoDuration, stepSeconds * maxVideoFrames),
        stepSeconds,
        aspectRatio: 'free',
        quality: 0.9,
        maxWidth: 1280,
        enableDuplicateRemoval: false,
        duplicateThreshold: 0.02,
        enableBgRemoval: true,
        bgRemovalModel: model === 'isnet' ? 'isnet' : model,
        bgRemovalDevice: device,
        bgRefineEdges: refineEdges,
      });

      let count = 0;
      for await (const frame of generator) {
        count++;
        const enhanced: ExtractedFrame = {
          ...frame,
          previewUrl: URL.createObjectURL(frame.blob),
        };
        setVideoFrames((prev) => [...prev, enhanced]);
        const pct = Math.min(100, Math.round((count / estFrames) * 100));
        setVideoProgress(pct);
        setVideoStatusMsg(`Processed frame #${count} (${(frame.timestamp).toFixed(1)}s)`);

        if (count >= maxVideoFrames) break;
      }

      setVideoStatusMsg(`Extracted ${count} transparent video frames successfully!`);
      setVideoProgress(100);
    } catch (err) {
      console.error('Video background removal failed:', err);
      alert('An error occurred during video background extraction.');
    } finally {
      setIsExtractingVideo(false);
    }
  };

  // Download single image result
  const downloadSingle = (item: BatchImageItem) => {
    if (!item.resultUrl) return;
    const base = item.file.name.replace(/\.[^/.]+$/, '');
    const ext = exportFormat === 'image/webp' ? 'webp' : 'png';
    const a = document.createElement('a');
    a.href = item.resultUrl;
    a.download = `${base}_transparent.${ext}`;
    a.click();
  };

  // Download all image results as ZIP
  const downloadAllImagesZip = async () => {
    const readyItems = images.filter((img) => img.resultBlob && img.status === 'done');
    if (readyItems.length === 0) return;

    const zip = new JSZip();
    const ext = exportFormat === 'image/webp' ? 'webp' : 'png';

    readyItems.forEach((img, i) => {
      const base = img.file.name.replace(/\.[^/.]+$/, '');
      zip.file(`${base}_transparent_${i + 1}.${ext}`, img.resultBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `transparent_images_${Date.now()}.zip`);
  };

  // Download video frames as ZIP
  const downloadVideoFramesZip = async () => {
    if (videoFrames.length === 0 || !videoFile) return;
    const base = videoFile.name.replace(/\.[^/.]+$/, '');
    await downloadFramesAsZip(videoFrames, `${base}_transparent`, {
      namingPattern: 'frame_{index}',
      subfolder: 'transparent_frames',
    });
  };

  const removeImageItem = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((item) => {
        if (item.id === id) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          return false;
        }
        return true;
      });
      if (selectedIndex >= filtered.length) {
        setSelectedIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const currentItem = images[selectedIndex] || null;

  // Split comparison dragging with smooth pointer capture
  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingSliderRef.current = true;
    updateSliderFromClientX(e.clientX);
  }, [updateSliderFromClientX]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSliderRef.current) {
      updateSliderFromClientX(e.clientX);
    }
  }, [updateSliderFromClientX]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSliderRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Top Hardware Diagnostics Banner ── */}
      <div style={{
        background: 'rgba(31, 31, 31, 0.8)',
        border: '1px solid var(--border-card)',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', background: 'rgba(255, 90, 9, 0.12)', border: '1px solid rgba(255, 90, 9, 0.3)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mint)', flexShrink: 0,
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Neural Vision Engine v2.0
              </span>
              {hasWebGPU ? (
                <span className="badge badge-mint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={11} /> WebGPU Accelerated (Ultra Fast)
                </span>
              ) : (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                  <Cpu size={11} /> CPU WASM (Multi-threaded)
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Full precision IS-Net Dichotomous Segmentation with edge de-fringing and zero server uploads.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="tabs" style={{ margin: 0 }}>
          <button
            className={`tab-btn${activeTab === 'image' ? ' active' : ''}`}
            onClick={() => setActiveTab('image')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ImageIcon size={14} /> Images & Batch
          </button>
          <button
            className={`tab-btn${activeTab === 'video' ? ' active' : ''}`}
            onClick={() => setActiveTab('video')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Video size={14} /> Video to Frames
          </button>
        </div>
      </div>

      {/* ── Main Tool Grid ── */}
      <div className="tool-grid">
        {/* ── LEFT: Settings & Upload ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Upload Area */}
          {activeTab === 'image' ? (
            <div
              className={`upload-zone${isDragging ? ' dragging' : ''}${images.length > 0 ? ' has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon"><UploadCloud size={22} /></div>
              <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {images.length > 0 ? 'Drop more images here' : 'Drop images here'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                PNG · JPEG · WebP (Single or Multi-file Batch)
              </p>
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files && handleImageFiles(e.target.files)}
                aria-label="Upload images for background removal"
              />
            </div>
          ) : (
            <div
              className={`upload-zone${isDragging ? ' dragging' : ''}${videoFile ? ' has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {videoFile ? (
                <div style={{ textAlign: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
                  <div className="upload-icon" style={{ margin: '0 auto 12px' }}>
                    <Video size={22} />
                  </div>
                  <p style={{ color: 'var(--mint)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }} className="truncate">
                    {videoFile.name}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
                    {formatFileSize(videoFile.size)} · {formatTime(videoDuration)}
                  </p>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { setVideoFile(null); setVideoFrames([]); }}
                    style={{ margin: '0 auto', display: 'flex' }}
                  >
                    <X size={13} /> Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="upload-icon"><Video size={22} /></div>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Drop video here
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>.mp4 · .webm · .mov</p>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => e.target.files?.[0] && handleVideoFile(e.target.files[0])}
                    aria-label="Upload video for background removal"
                  />
                </>
              )}
            </div>
          )}

          {/* Model Accuracy Preset */}
          <div className="card card-sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ margin: 0 }}>Accuracy & Model Preset</label>
              <span className="badge badge-mint" style={{ fontSize: '10px' }}>
                {model === 'isnet' ? 'Highest Precision' : model === 'isnet_fp16' ? 'Fast & Crisp' : 'High Speed'}
              </span>
            </div>
            <div className="tabs bg-model-tabs" style={{ marginBottom: '8px' }}>
              <button
                className={`tab-btn${model === 'isnet' ? ' active' : ''}`}
                onClick={() => setModel('isnet')}
                title="Full 32-bit floating point precision model"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Sparkles size={13} /> Ultra (FP32)
              </button>
              <button
                className={`tab-btn${model === 'isnet_fp16' ? ' active' : ''}`}
                onClick={() => setModel('isnet_fp16')}
                title="16-bit half precision model"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Sliders size={13} /> Balanced (FP16)
              </button>
              <button
                className={`tab-btn${model === 'isnet_quint8' ? ' active' : ''}`}
                onClick={() => setModel('isnet_quint8')}
                title="Quantized 8-bit model for maximum speed"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Zap size={13} /> Turbo (INT8)
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {model === 'isnet'
                ? 'Full 32-bit neural weights. Recommended for hair, subtle clothing boundaries, and studio cutouts.'
                : model === 'isnet_fp16'
                ? 'Half-precision model. 2x faster execution while keeping sharp boundary details.'
                : 'Quantized INT8 model for extreme processing speed. Ideal for rapid video frame sequences.'}
            </p>
          </div>

          {/* Video Settings (if in Video Tab) */}
          {activeTab === 'video' && (
            <div className="card card-sm">
              <label style={{ marginBottom: '10px' }}>Video Frame Sampling</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Extract Interval:</span>
                    <span className="mono" style={{ color: 'var(--mint)' }}>Every {videoInterval}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="5"
                    step="0.2"
                    value={videoInterval}
                    onChange={(e) => setVideoInterval(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Max Frames Cap:</span>
                    <span className="mono" style={{ color: 'var(--mint)' }}>{maxVideoFrames} frames</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={maxVideoFrames}
                    onChange={(e) => setMaxVideoFrames(parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Edge Refinement & Matting Accordion */}
          <div className="card card-sm">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px' }}>
                <Sliders size={14} style={{ color: 'var(--mint)' }} />
                <span>Edge Refinement & Matting</span>
              </div>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-card)' }} className="fade-up">
                {/* Refine Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={refineEdges}
                    onChange={(e) => setRefineEdges(e.target.checked)}
                    style={{ accentColor: 'var(--mint)' }}
                  />
                  <span>Enable Studio Edge Matting</span>
                </label>

                {refineEdges && (
                  <>
                    {/* Feather */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Edge Feathering (Anti-Aliasing):</span>
                        <span className="mono" style={{ color: 'var(--mint)' }}>{featherRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="4"
                        step="0.5"
                        value={featherRadius}
                        onChange={(e) => setFeatherRadius(parseFloat(e.target.value))}
                      />
                    </div>

                    {/* Threshold */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Alpha Noise Cutoff:</span>
                        <span className="mono" style={{ color: 'var(--mint)' }}>{thresholdCutoff}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="35"
                        step="1"
                        value={thresholdCutoff}
                        onChange={(e) => setThresholdCutoff(parseInt(e.target.value))}
                      />
                    </div>

                    {/* De-fringe */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={deFringe}
                        onChange={(e) => setDeFringe(e.target.checked)}
                        style={{ accentColor: 'var(--mint)' }}
                      />
                      <span>De-fringe (Neutralize background color halos)</span>
                    </label>
                  </>
                )}

                {/* Resolution Limit */}
                <div style={{ marginTop: '4px' }}>
                  <label style={{ fontSize: '11.5px', marginBottom: '6px' }}>Max Processing Dimension</label>
                  <select
                    value={maxDimension}
                    onChange={(e) => setMaxDimension(parseInt(e.target.value))}
                    style={{ width: '100%', fontSize: '12px' }}
                  >
                    <option value={0}>Original Resolution (Highest Accuracy)</option>
                    <option value={1920}>Full HD (1920px - Fast & High Quality)</option>
                    <option value={1280}>HD (1280px - High Speed)</option>
                    <option value={800}>Web (800px - Extreme Speed)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Export Format & Device */}
          <div className="card card-sm">
            <div className="bg-configuration-tabs">
              <div>
                <label style={{ marginBottom: '6px' }}>Export Format</label>
                <div className="tabs">
                  <button
                    className={`tab-btn${exportFormat === 'image/png' ? ' active' : ''}`}
                    onClick={() => setExportFormat('image/png')}
                  >
                    PNG
                  </button>
                  <button
                    className={`tab-btn${exportFormat === 'image/webp' ? ' active' : ''}`}
                    onClick={() => setExportFormat('image/webp')}
                  >
                    WebP
                  </button>
                </div>
              </div>

              <div>
                <label style={{ marginBottom: '6px' }}>Device Acceleration</label>
                <div className="tabs">
                  <button
                    className={`tab-btn${device === 'gpu' ? ' active' : ''}`}
                    onClick={() => setDevice('gpu')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Cpu size={13} /> GPU
                  </button>
                  <button
                    className={`tab-btn${device === 'cpu' ? ' active' : ''}`}
                    onClick={() => setDevice('cpu')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Monitor size={13} /> CPU
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          {activeTab === 'image' ? (
            <button
              className="btn btn-primary btn-lg"
              disabled={images.length === 0 || isProcessingImages}
              onClick={processImages}
              id="remove-bg-btn"
            >
              {isProcessingImages ? (
                <><RefreshCw size={16} className="spin" /> {statusMsg || 'Processing…'}</>
              ) : (
                <><Eraser size={16} /> Remove Background {images.length > 1 ? `(${images.length} Images)` : ''}</>
              )}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              disabled={!videoFile || isExtractingVideo}
              onClick={processVideo}
              id="remove-video-bg-btn"
            >
              {isExtractingVideo ? (
                <><RefreshCw size={16} className="spin" /> {videoStatusMsg || 'Extracting frames…'}</>
              ) : (
                <><Sparkles size={16} /> Extract Transparent Frames</>
              )}
            </button>
          )}

          {/* Progress Bar */}
          {(isProcessingImages || isExtractingVideo) && (
            <div className="fade-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>{activeTab === 'image' ? statusMsg : videoStatusMsg}</span>
                <span className="mono">{activeTab === 'image' ? globalProgress : videoProgress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${activeTab === 'image' ? globalProgress : videoProgress}%` }} />
              </div>
            </div>
          )}

          {/* Batch Thumbnails Strip (if multiple images) */}
          {activeTab === 'image' && images.length > 1 && (
            <div className="card card-sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Batch Queue ({images.length})</span>
                {images.some((img) => img.status === 'done') && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={downloadAllImagesZip}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    <Download size={12} /> Download ZIP
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                {images.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedIndex(idx)}
                    style={{
                      position: 'relative', width: '100%', height: '56px', borderRadius: '6px',
                      overflow: 'hidden', border: selectedIndex === idx ? '2px solid var(--mint)' : '1px solid var(--border)',
                      cursor: 'pointer', background: '#000',
                    }}
                  >
                    <img src={item.resultUrl || item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {item.status === 'done' && (
                      <div style={{ position: 'absolute', top: 2, right: 2, background: 'var(--mint)', borderRadius: '50%', padding: '1px' }}>
                        <Check size={10} color="#000" />
                      </div>
                    )}
                    {item.status === 'processing' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={14} className="spin" color="var(--mint)" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Interactive Before/After Preview & Video Gallery ── */}
        <div className="card" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeTab === 'image' ? (
            !currentItem ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                <Eraser size={52} strokeWidth={1} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: '14px' }}>Upload an image to inspect high-accuracy background removal</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Preview Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Backdrop Selector */}
                  <div className="bg-backdrop-buttons">
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Backdrop:</span>
                    <button
                      type="button"
                      className={`ratio-btn${backdrop === 'checker' ? ' active' : ''}`}
                      onClick={() => setBackdrop('checker')}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title="Checkerboard Transparent"
                    >
                      <Grid size={11} /> Grid
                    </button>
                    <button
                      type="button"
                      className={`ratio-btn${backdrop === 'white' ? ' active' : ''}`}
                      onClick={() => setBackdrop('white')}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title="Solid White"
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffffff', border: '1px solid #71717a', display: 'inline-block' }} /> White
                    </button>
                    <button
                      type="button"
                      className={`ratio-btn${backdrop === 'black' ? ' active' : ''}`}
                      onClick={() => setBackdrop('black')}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title="Solid Black"
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#09090b', border: '1px solid #3f3f46', display: 'inline-block' }} /> Black
                    </button>
                    <button
                      type="button"
                      className={`ratio-btn${backdrop === 'green' ? ' active' : ''}`}
                      onClick={() => setBackdrop('green')}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title="Studio Green Screen"
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} /> Green
                    </button>
                    <label
                      className={`ratio-btn${backdrop === 'custom' ? ' active' : ''}`}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Palette size={11} /> Color
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => { setCustomColor(e.target.value); setBackdrop('custom'); }}
                        style={{ width: '0px', height: '0px', opacity: 0, position: 'absolute' }}
                      />
                    </label>
                  </div>

                  {/* Split compare toggle & Download */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {currentItem.resultUrl && (
                      <button
                        className={`tab-btn${isComparing ? ' active' : ''}`}
                        onClick={() => setIsComparing(!isComparing)}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        <Eye size={12} /> {isComparing ? 'Split Slider' : 'Result Only'}
                      </button>
                    )}
                    {currentItem.resultUrl && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => downloadSingle(currentItem)}
                        style={{ fontSize: '12px' }}
                      >
                        <Download size={13} /> Download
                      </button>
                    )}
                  </div>
                </div>

                {/* Stage Canvas / Split Compare Viewport */}
                <div
                  ref={compareContainerRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    position: 'relative',
                    flex: 1,
                    minHeight: '380px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    userSelect: 'none',
                    touchAction: 'none',
                    cursor: currentItem.resultUrl && isComparing ? 'ew-resize' : 'default',
                    background:
                      backdrop === 'checker'
                        ? 'repeating-conic-gradient(rgba(255,255,255,0.06) 0% 25%, rgba(255,255,255,0.01) 0% 50%) 0 0 / 14px 14px'
                        : backdrop === 'white'
                        ? '#ffffff'
                        : backdrop === 'black'
                        ? '#000000'
                        : backdrop === 'green'
                        ? '#00e676'
                        : backdrop === 'custom'
                        ? customColor
                        : '#141414',
                  }}
                >
                  {/* If result is available and comparing */}
                  {currentItem.resultUrl && isComparing ? (
                    <>
                      {/* Under layer: Transparent Cutout on the selected backdrop */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <img
                          src={currentItem.resultUrl}
                          alt="AI Cutout"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                          draggable={false}
                        />
                        <div style={{
                          position: 'absolute', top: 12, right: 12, background: 'rgba(255, 90, 9, 0.9)',
                          color: '#fff', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700,
                          letterSpacing: '0.5px', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', zIndex: 5
                        }}>
                          AI CUTOUT
                        </div>
                      </div>

                      {/* Top layer: Original image with neutral background underneath, clipped to the left of the slider line */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
                          background: backdrop === 'white' ? '#ffffff' : backdrop === 'black' ? '#000000' : '#141414',
                          pointerEvents: 'none',
                        }}
                      >
                        <img
                          src={currentItem.previewUrl}
                          alt="Original"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                          draggable={false}
                        />
                        <div style={{
                          position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.8)',
                          color: '#fff', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700,
                          letterSpacing: '0.5px', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', zIndex: 5
                        }}>
                          ORIGINAL
                        </div>
                      </div>

                      {/* Vertical Divider Line */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: `${sliderPosition}%`,
                          width: '2px',
                          transform: 'translateX(-50%)',
                          background: 'var(--mint)',
                          boxShadow: '0 0 8px rgba(0,0,0,0.7)',
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Draggable Handle Button */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: `${sliderPosition}%`,
                          transform: 'translate(-50%, -50%)',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--mint)',
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          zIndex: 11,
                          pointerEvents: 'none',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                          <polyline points="9 18 3 12 9 6" />
                        </svg>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)', marginLeft: '-6px' }}>
                          <polyline points="15 18 9 12 15 6" />
                          <polyline points="9 18 3 12 9 6" />
                        </svg>
                      </div>

                      {/* Transparent range slider input for keyboard arrows and instant click-to-jump */}
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={sliderPosition}
                        onChange={(e) => setSliderPosition(parseFloat(e.target.value))}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'ew-resize',
                          zIndex: 15,
                          margin: 0,
                          padding: 0,
                        }}
                        aria-label="Split comparison slider"
                      />
                    </>
                  ) : currentItem.resultUrl ? (
                    /* Show result only */
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={currentItem.resultUrl}
                        alt="Transparent Result"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    /* Show original only before processing */
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={currentItem.previewUrl}
                        alt="Original"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        draggable={false}
                      />
                    </div>
                  )}
                </div>

                {/* Diagnostics / Speed report */}
                {currentItem.status === 'done' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                    background: 'rgba(255, 90, 9, 0.08)', border: '1px solid rgba(255, 90, 9, 0.25)',
                    borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--mint)', gap: '8px'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={15} />
                      Background removed cleanly ({currentItem.resultBlob ? formatFileSize(currentItem.resultBlob.size) : ''})
                    </span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Speed: {currentItem.timeMs ? `${currentItem.timeMs}ms` : 'Fast'} · {currentItem.deviceUsed || 'GPU'}
                    </span>
                  </div>
                )}
              </div>
            )
          ) : (
            /* ── VIDEO MODE GALLERY ── */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Video size={16} style={{ color: 'var(--mint)' }} />
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                    Transparent Video Frames
                  </span>
                  <span className="badge badge-mint">{videoFrames.length} Extracted</span>
                </div>

                {videoFrames.length > 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={downloadVideoFramesZip}
                    style={{ fontSize: '12px' }}
                  >
                    <Download size={13} /> Download All (ZIP)
                  </button>
                )}
              </div>

              {videoFrames.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px', minHeight: '320px' }}>
                  <Video size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
                  <p style={{ fontSize: '14px' }}>
                    {videoFile
                      ? 'Click "Extract Transparent Frames" to start GPU-accelerated video background removal'
                      : 'Upload a video to extract transparent PNG frames'}
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px', maxHeight: '420px', overflowY: 'auto'
                }}>
                  {videoFrames.map((frame) => (
                    <div
                      key={frame.id}
                      style={{
                        position: 'relative', height: '95px', borderRadius: '8px', overflow: 'hidden',
                        border: '1px solid var(--border)',
                        background: 'repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, rgba(255,255,255,0.01) 0% 50%) 0 0 / 12px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {frame.previewUrl && (
                        <img src={frame.previewUrl} alt={`Frame ${frame.number}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      )}
                      <div className="frame-thumb-label" style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.7)', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>
                        #{frame.number} · {frame.timestamp.toFixed(1)}s
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
