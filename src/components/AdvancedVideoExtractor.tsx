'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Download, RefreshCw, X, Video, UploadCloud, Settings, Play, Pause,
  Scissors, Grid3X3, Trash2, CheckSquare, Square, Eye, Info, Sparkles, Zap
} from 'lucide-react';
import { useVideoExtractor } from '@/hooks/useVideoExtractor';
import { getVideoMetadata, estimateFrameSize, ExtractionOptions, AspectRatio } from '@/lib/videoUtils';
import { downloadFramesAsZip } from '@/lib/zipUtils';
import { formatFileSize, formatTime } from '@/lib/utils';
import { ExtractedFrame } from '@/lib/videoUtils';

// ─── Dual Range Slider ───────────────────────────────────────────────────────
interface DualRangeProps {
  min: number;
  max: number;
  start: number;
  end: number;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
  disabled?: boolean;
}

function DualRangeSlider({ min, max, start, end, onStartChange, onEndChange, disabled }: DualRangeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const leftPct = max > 0 ? ((start - min) / (max - min)) * 100 : 0;
  const rightPct = max > 0 ? ((end - min) / (max - min)) * 100 : 100;

  return (
    <div style={{ position: 'relative', paddingTop: '8px' }}>
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          height: '4px',
          background: 'var(--bg-secondary)',
          borderRadius: '4px',
          margin: '8px 0',
        }}
      >
        {/* filled portion */}
        <div
          style={{
            position: 'absolute',
            left: `${leftPct}%`,
            right: `${100 - rightPct}%`,
            height: '4px',
            background: 'linear-gradient(90deg, var(--mint-dim), var(--mint))',
            borderRadius: '4px',
            top: 0,
          }}
        />
        {/* Start handle */}
        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={start}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v < end) onStartChange(v);
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: '100%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            pointerEvents: 'none',
            zIndex: 2,
          }}
          className="dual-thumb"
        />
        {/* End handle */}
        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={end}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > start) onEndChange(v);
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: '100%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            pointerEvents: 'none',
            zIndex: 3,
          }}
          className="dual-thumb"
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
        <span style={{ color: 'var(--mint)' }}>{formatTime(start)}</span>
        <span>{formatTime(max)}</span>
        <span style={{ color: 'var(--mint)' }}>{formatTime(end)}</span>
      </div>
    </div>
  );
}

// ─── Frame Gallery ────────────────────────────────────────────────────────────
interface FrameGalleryProps {
  frames: ExtractedFrame[];
  onToggleDelete: (id: string) => void;
}

function FrameGallery({ frames, onToggleDelete }: FrameGalleryProps) {
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = () => {
    const newVal = !selectAll;
    setSelectAll(newVal);
    // Mark all as deleted or not
    frames.forEach((f) => {
      if (newVal !== !!f.deleted) onToggleDelete(f.id);
    });
  };

  if (frames.length === 0) return null;

  const deletedCount = frames.filter((f) => f.deleted).length;
  const activeCount = frames.length - deletedCount;

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Eye size={18} style={{ color: 'var(--mint)' }} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Frame Gallery
          </span>
          <span className="badge badge-mint">{activeCount} active</span>
          {deletedCount > 0 && (
            <span className="badge badge-red">{deletedCount} culled</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <button
            onClick={handleSelectAll}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit' }}
          >
            {selectAll ? <CheckSquare size={14} /> : <Square size={14} />}
            {selectAll ? 'Unmark all' : 'Mark all for deletion'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
        {frames.map((frame) => (
          <div
            key={frame.id}
            onClick={() => onToggleDelete(frame.id)}
            className={`frame-thumb${frame.deleted ? ' deleted' : ''}`}
            title={`Frame ${frame.number} — ${formatTime(frame.timestamp)} — Click to ${frame.deleted ? 'restore' : 'cull'}`}
            role="button"
            aria-pressed={!!frame.deleted}
            aria-label={`Frame ${frame.number} at ${formatTime(frame.timestamp)}`}
            style={{
              aspectRatio: 'unset',
              height: '90px',
              background: 'repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, rgba(255,255,255,0.01) 0% 50%) 0 0 / 12px 12px'
            }}
          >
            {frame.previewUrl && (
              <img src={frame.previewUrl} alt={`Frame ${frame.number}`} />
            )}
            <div className="frame-thumb-overlay">
              {frame.deleted ? (
                <RefreshCw size={18} style={{ color: 'white' }} />
              ) : (
                <Trash2 size={18} style={{ color: '#f87171' }} />
              )}
            </div>
            <div className="frame-thumb-label">#{frame.number}</div>
            {frame.deleted && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase'
              }}>
                CULLED
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
        Click any frame to cull/restore it. Culled frames are excluded from the ZIP export.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const RATIO_PRESETS: { label: string; value: AspectRatio }[] = [
  { label: 'Free', value: 'free' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
];

export function AdvancedVideoExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  // Timeline
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  // Extraction settings
  const [intervalMode, setIntervalMode] = useState<'seconds' | 'fps'>('seconds');
  const [intervalSeconds, setIntervalSeconds] = useState(1);
  const [fps, setFps] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [quality, setQuality] = useState(0.75);
  const [enableDupRemoval, setEnableDupRemoval] = useState(true);
  const [enableBgRemoval, setEnableBgRemoval] = useState(false);
  const [bgRemovalModel, setBgRemovalModel] = useState<'isnet' | 'isnet_fp16' | 'isnet_quint8'>('isnet_quint8');

  // ZIP export
  const [namingPattern, setNamingPattern] = useState('frame_{index}');
  const [subfolderName, setSubfolderName] = useState('frames');
  const [zipProgress, setZipProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Size estimate
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimatedFrames, setEstimatedFrames] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    frames,
    setFrames,
    isExtracting,
    isPaused,
    progress,
    totalEstimated,
    startExtraction,
    pauseExtraction,
    resetState: resetHookState,
  } = useVideoExtractor();

  // Load video metadata when file changes
  useEffect(() => {
    if (!file) {
      setVideoDuration(0);
      setStartTime(0);
      setEndTime(0);
      setEstimatedSize(null);
      setEstimatedFrames(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        const meta = await getVideoMetadata(file);
        if (!active) return;
        setVideoDuration(meta.duration);
        setStartTime(0);
        setEndTime(meta.duration);
      } catch {
        // ignore
      }
    })();

    return () => { active = false; };
  }, [file]);

  // Recompute size estimate when settings change
  useEffect(() => {
    if (!file || videoDuration === 0) {
      setEstimatedSize(null);
      setEstimatedFrames(null);
      return;
    }

    let active = true;
    setIsEstimating(true);

    (async () => {
      try {
        const stepSec = intervalMode === 'seconds' ? intervalSeconds : 1 / fps;
        const trimDuration = Math.max(0, endTime - startTime);
        const totalF = Math.max(1, Math.ceil(trimDuration / stepSec));

        const frameSize = await estimateFrameSize(file, startTime, {
          aspectRatio,
          quality,
          maxWidth: 1280,
        });

        if (!active) return;
        setEstimatedFrames(totalF);
        setEstimatedSize(totalF * frameSize);
      } catch {
        // ignore
      } finally {
        if (active) setIsEstimating(false);
      }
    })();

    return () => { active = false; };
  }, [file, videoDuration, intervalMode, intervalSeconds, fps, startTime, endTime, aspectRatio, quality]);

  const handleFileSelect = useCallback((f: File) => {
    const valid = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (valid.includes(f.type)) {
      setFile(f);
      resetHookState();
    } else {
      alert('Please upload a valid video file (.mp4, .webm, .mov)');
    }
  }, [resetHookState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const resetAll = useCallback(() => {
    setFile(null);
    resetHookState();
    setVideoDuration(0);
    setStartTime(0);
    setEndTime(0);
  }, [resetHookState]);

  const buildOptions = (): ExtractionOptions => ({
    startTime,
    endTime,
    stepSeconds: intervalMode === 'seconds' ? intervalSeconds : 1 / fps,
    aspectRatio,
    quality,
    maxWidth: 1280,
    enableDuplicateRemoval: enableDupRemoval,
    duplicateThreshold: 0.02,
    enableBgRemoval,
    bgRemovalModel,
    bgRemovalDevice: 'gpu',
    bgRefineEdges: true,
  });

  const handleStart = (resume = false) => {
    if (!file) return;
    startExtraction(file, buildOptions(), resume);
  };

  const handleToggleDelete = useCallback((id: string) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, deleted: !f.deleted } : f))
    );
  }, [setFrames]);

  const handleDownload = async () => {
    if (frames.length === 0) return;
    setIsDownloading(true);
    setZipProgress(0);
    try {
      const base = file?.name.replace(/\.[^/.]+$/, '') || 'extracted';
      await downloadFramesAsZip(frames, base, {
        namingPattern: namingPattern || 'frame_{index}',
        subfolder: subfolderName || base,
        onProgress: setZipProgress,
      });
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to create ZIP file.');
    } finally {
      setIsDownloading(false);
      setZipProgress(0);
    }
  };

  const activeFrames = frames.filter((f) => !f.deleted).length;
  const currentTotal = totalEstimated || estimatedFrames || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Stats Row ── */}
      {file && (
        <div className="stat-row fade-up">
          <div className="stat-tile">
            <div className="stat-value">{frames.length}</div>
            <div className="stat-label">Extracted</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{activeFrames}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value mono" style={{ fontSize: '14px' }}>
              {isEstimating ? '...' : estimatedSize ? `~${formatFileSize(estimatedSize)}` : '—'}
            </div>
            <div className="stat-label">Est. Output</div>
          </div>
        </div>
      )}

      <div className="tool-grid">
        {/* ── Left Panel ── */}
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
                  <Video size={22} />
                </div>
                <p style={{ color: 'var(--mint)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }} className="truncate">
                  {file.name}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>
                  {formatFileSize(file.size)} · {formatTime(videoDuration)}
                </p>
                <button className="btn btn-danger btn-sm" onClick={resetAll} style={{ margin: '8px auto 0', display: 'flex' }}>
                  <X size={13} /> Remove
                </button>
              </div>
            ) : (
              <>
                <div className="upload-icon">
                  <UploadCloud size={22} />
                </div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '14px' }}>
                  Drop video here
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>.mp4 · .webm · .mov</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  aria-label="Upload video file"
                />
              </>
            )}
          </div>

          {/* Timeline Trimmer */}
          <div className="card card-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Scissors size={15} style={{ color: 'var(--mint)' }} />
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Timeline Trimmer</span>
            </div>
            <DualRangeSlider
              min={0}
              max={videoDuration || 100}
              start={startTime}
              end={endTime}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
              disabled={isExtracting || isPaused || !file}
            />
          </div>

          {/* Aspect Ratio */}
          <div className="card card-sm">
            <label style={{ marginBottom: '10px' }}>Crop Preset</label>
            <div className="ratio-presets">
              {RATIO_PRESETS.map(({ label, value }) => (
                <button
                  key={value}
                  className={`ratio-btn${aspectRatio === value ? ' active' : ''}`}
                  onClick={() => setAspectRatio(value)}
                  disabled={isExtracting || isPaused}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Extraction Settings */}
          <div className="card card-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Settings size={15} style={{ color: 'var(--mint)' }} />
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Extraction Settings</span>
            </div>

            {/* Mode tabs */}
            <div className="tabs" style={{ marginBottom: '14px' }}>
              <button
                className={`tab-btn${intervalMode === 'seconds' ? ' active' : ''}`}
                onClick={() => setIntervalMode('seconds')}
                disabled={isExtracting || isPaused}
              >
                Every N seconds
              </button>
              <button
                className={`tab-btn${intervalMode === 'fps' ? ' active' : ''}`}
                onClick={() => setIntervalMode('fps')}
                disabled={isExtracting || isPaused}
              >
                Target FPS
              </button>
            </div>

            {intervalMode === 'seconds' ? (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Interval</span>
                  <span style={{ color: 'var(--mint)' }} className="mono">{intervalSeconds}s</span>
                </label>
                <input type="range" min="0.1" max="10" step="0.1" value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(parseFloat(e.target.value))}
                  disabled={isExtracting || isPaused} />
              </div>
            ) : (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Frames per second</span>
                  <span style={{ color: 'var(--mint)' }} className="mono">{fps} fps</span>
                </label>
                <input type="range" min="1" max="30" step="1" value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  disabled={isExtracting || isPaused} />
              </div>
            )}

            {/* Quality */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>WebP Quality</span>
                <span style={{ color: 'var(--mint)' }} className="mono">{Math.round(quality * 100)}%</span>
              </label>
              <input type="range" min="0.1" max="1" step="0.05" value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                disabled={isExtracting || isPaused} />
            </div>

            {/* Duplicate removal toggle */}
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontSize: '13px', fontWeight: 500, marginBottom: 0 }}
              htmlFor="dup-removal"
            >
              <input
                id="dup-removal"
                type="checkbox"
                checked={enableDupRemoval}
                onChange={(e) => setEnableDupRemoval(e.target.checked)}
                disabled={isExtracting || isPaused}
                style={{ width: '14px', height: '14px', accentColor: 'var(--mint)', cursor: 'pointer' }}
              />
              Smart Duplicate Removal (&lt;2% diff)
            </label>

            {/* AI Transparent Background Removal */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-card)' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: enableBgRemoval ? 'var(--mint)' : 'var(--text-primary)',
                  marginBottom: enableBgRemoval ? '10px' : 0,
                }}
                htmlFor="bg-removal-toggle"
              >
                <input
                  id="bg-removal-toggle"
                  type="checkbox"
                  checked={enableBgRemoval}
                  onChange={(e) => setEnableBgRemoval(e.target.checked)}
                  disabled={isExtracting || isPaused}
                  style={{ width: '14px', height: '14px', accentColor: 'var(--mint)', cursor: 'pointer' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={14} style={{ color: 'var(--mint)' }} />
                  AI Transparent Frames (Remove Background)
                </span>
              </label>

              {enableBgRemoval && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '22px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`tab-btn${bgRemovalModel === 'isnet_quint8' ? ' active' : ''}`}
                      onClick={() => setBgRemovalModel('isnet_quint8')}
                      style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      disabled={isExtracting || isPaused}
                    >
                      <Zap size={12} /> Turbo (Fast)
                    </button>
                    <button
                      type="button"
                      className={`tab-btn${bgRemovalModel === 'isnet_fp16' ? ' active' : ''}`}
                      onClick={() => setBgRemovalModel('isnet_fp16')}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      disabled={isExtracting || isPaused}
                    >
                      Balanced
                    </button>
                    <button
                      type="button"
                      className={`tab-btn${bgRemovalModel === 'isnet' ? ' active' : ''}`}
                      onClick={() => setBgRemovalModel('isnet')}
                      style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      disabled={isExtracting || isPaused}
                    >
                      <Sparkles size={12} /> Ultra
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Extracts transparent PNG frames using WebGPU hardware acceleration.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ZIP Export Options */}
          <div className="card card-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Grid3X3 size={15} style={{ color: 'var(--mint)' }} />
              <span style={{ fontWeight: 700, fontSize: '13px' }}>ZIP Export Options</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label>Naming Pattern</label>
                <input
                  type="text"
                  value={namingPattern}
                  onChange={(e) => setNamingPattern(e.target.value)}
                  placeholder="frame_{index}"
                  id="naming-pattern"
                />
                <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Tokens: <code style={{ color: 'var(--mint)' }}>{'{index}'}</code>{' '}
                  <code style={{ color: 'var(--mint)' }}>{'{timestamp}'}</code>{' '}
                  <code style={{ color: 'var(--mint)' }}>{'{number}'}</code>
                </p>
              </div>
              <div>
                <label>Subfolder Name</label>
                <input
                  type="text"
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  placeholder="frames"
                  id="subfolder-name"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
            {!file ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                <Video size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: '14px' }}>Upload a video to begin</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {isExtracting ? 'Extracting…'
                        : isPaused ? 'Paused'
                        : frames.length > 0 ? 'Extraction Complete'
                        : 'Ready to Extract'}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {frames.length} / {currentTotal || '?'} frames
                      {frames.length > 0 && ` · ${formatFileSize(frames.reduce((a, f) => a + f.size, 0))}`}
                    </p>
                  </div>
                  {isExtracting && (
                    <div className="pulse-dot" aria-label="Extracting" />
                  )}
                </div>

                {/* Progress */}
                <div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${currentTotal ? Math.min(100, (frames.length / currentTotal) * 100) : 0}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    <span>{Math.round(currentTotal ? Math.min(100, (frames.length / currentTotal) * 100) : 0)}%</span>
                    <span>Max width: 1280px · WebP</span>
                  </div>
                </div>

                {/* Estimate banner */}
                {!isExtracting && !isPaused && frames.length === 0 && (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <Info size={15} style={{ color: 'var(--mint)' }} />
                      Estimated output size
                    </div>
                    <span style={{ color: 'var(--mint)', fontWeight: 600, fontFamily: 'monospace', fontSize: '14px' }}>
                      {isEstimating ? '…' : estimatedSize ? `~${formatFileSize(estimatedSize)}` : '—'}
                    </span>
                  </div>
                )}

                {/* ZIP progress */}
                {isDownloading && (
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Compressing ZIP… {zipProgress}%
                    </p>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${zipProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 'auto' }}>
                  {!isExtracting && !isPaused && frames.length === 0 && (
                    <button
                      className="btn btn-primary btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => handleStart(false)}
                      id="start-extraction-btn"
                    >
                      <Play size={18} /> Start Extraction
                    </button>
                  )}

                  {isExtracting && (
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={pauseExtraction} id="pause-extraction-btn">
                      <Pause size={18} /> Pause
                    </button>
                  )}

                  {isPaused && (
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleStart(true)} id="resume-extraction-btn">
                      <Play size={18} /> Resume
                    </button>
                  )}

                  {frames.length > 0 && !isExtracting && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={resetAll}
                      style={{ flex: '0 0 auto' }}
                    >
                      <RefreshCw size={14} /> Reset
                    </button>
                  )}

                  <button
                    className="btn btn-secondary btn-lg"
                    style={{ flex: 1 }}
                    disabled={activeFrames === 0 || isDownloading}
                    onClick={handleDownload}
                    id="download-zip-btn"
                  >
                    {isDownloading
                      ? <><RefreshCw size={16} className="spin" /> Zipping…</>
                      : <><Download size={16} /> Export ZIP ({activeFrames})</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Frame Gallery */}
      <FrameGallery frames={frames} onToggleDelete={handleToggleDelete} />
    </div>
  );
}
