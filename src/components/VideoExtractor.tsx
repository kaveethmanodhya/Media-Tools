'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Download, RefreshCw, X, Video, UploadCloud, Settings, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadFramesAsZip } from '@/lib/zipUtils';
import { PreviewGallery } from './PreviewGallery';
import { formatFileSize } from '@/lib/utils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useVideoExtractor } from '@/hooks/useVideoExtractor';
import { getVideoMetadata, estimateFrameSize } from '@/lib/videoUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function VideoExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [intervalMode, setIntervalMode] = useState<'seconds' | 'fps'>('seconds');
  const [intervalSeconds, setIntervalSeconds] = useState<number>(1);
  const [fps, setFps] = useState<number>(30);
  
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimatedFrames, setEstimatedFrames] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const {
    frames,
    isExtracting,
    isPaused,
    progress,
    totalEstimated,
    startExtraction,
    pauseExtraction,
    resetState: resetHookState,
  } = useVideoExtractor();
  
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (file) {
      setIsEstimating(true);
      (async () => {
        try {
          const metadata = await getVideoMetadata(file);
          const stepSeconds = intervalMode === 'seconds' ? intervalSeconds : 1 / fps;
          const totalF = Math.ceil(metadata.duration / stepSeconds);
          
          const frameSize = await estimateFrameSize(file);
          if (active) {
            setEstimatedFrames(totalF);
            setEstimatedSize(totalF * frameSize);
            setIsEstimating(false);
          }
        } catch (error) {
          if (active) setIsEstimating(false);
        }
      })();
    } else {
      setEstimatedSize(null);
      setEstimatedFrames(null);
    }
    return () => { active = false; };
  }, [file, intervalMode, intervalSeconds, fps]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (validTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      resetHookState();
    } else {
      alert('Please upload a valid video file (.mp4, .webm, .mov)');
    }
  };

  const resetState = () => {
    setFile(null);
    resetHookState();
  };

  const handleStartExtraction = (resume: boolean = false) => {
    if (file) {
      const stepSeconds = intervalMode === 'seconds' ? intervalSeconds : 1 / fps;
      startExtraction(
        file,
        {
          startTime: 0,
          endTime: 999999, // default to entire video
          stepSeconds,
          aspectRatio: 'free',
          quality: 0.75,
          maxWidth: 1280,
          enableDuplicateRemoval: false,
          duplicateThreshold: 0.02,
        },
        resume
      );
    }
  };

  const handleDownload = async () => {
    if (frames.length === 0) return;
    setIsDownloading(true);
    try {
      const baseFilename = file?.name.replace(/\.[^/.]+$/, "") || 'extracted';
      await downloadFramesAsZip(frames, baseFilename);
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to create ZIP file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const currentTotal = totalEstimated || estimatedFrames;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 tracking-tight">
          Frame<span className="text-white">X</span>tractor
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Extract high-quality WebP frames directly in your browser. Fast, secure, and private.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Settings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Zone */}
          <div
            className={cn(
              "relative group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl transition-all duration-300 bg-slate-900/50 backdrop-blur-xl",
              isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80",
              file ? "border-emerald-500/50" : ""
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="w-full text-center space-y-4 relative z-10">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-4">
                  <Video size={32} />
                </div>
                <div>
                  <p className="text-emerald-400 font-medium truncate px-4">{file.name}</p>
                  <p className="text-slate-400 text-sm mt-1">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={resetState}
                  className="mt-4 px-4 py-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center justify-center mx-auto gap-2"
                >
                  <X size={16} /> Remove
                </button>
              </div>
            ) : (
              <div className="text-center relative z-10 pointer-events-none">
                <div className="mx-auto w-20 h-20 bg-slate-800 rounded-3xl shadow-inner flex items-center justify-center text-slate-400 mb-6 group-hover:scale-110 group-hover:text-emerald-400 transition-all duration-300">
                  <UploadCloud size={40} strokeWidth={1.5} />
                </div>
                <p className="text-lg font-medium text-white mb-2">Drag & Drop your video</p>
                <p className="text-sm text-slate-400">Supports .mp4, .webm, .mov</p>
              </div>
            )}
            {!file && (
              <input
                type="file"
                ref={fileInputRef}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            )}
          </div>

          {/* Settings */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-3 text-white">
              <Settings size={20} className="text-emerald-400" />
              <h2 className="text-xl font-semibold">Extraction Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
                <button
                  onClick={() => setIntervalMode('seconds')}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                    intervalMode === 'seconds' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                  disabled={isExtracting || isPaused}
                >
                  Interval (s)
                </button>
                <button
                  onClick={() => setIntervalMode('fps')}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                    intervalMode === 'fps' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                  disabled={isExtracting || isPaused}
                >
                  Target FPS
                </button>
              </div>

              <AnimatePresence mode="wait">
                {intervalMode === 'seconds' ? (
                  <motion.div
                    key="seconds"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <label className="text-sm text-slate-400 flex justify-between">
                      <span>Extract every</span>
                      <span className="text-emerald-400 font-medium">{intervalSeconds}s</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={intervalSeconds}
                      onChange={(e) => setIntervalSeconds(parseFloat(e.target.value))}
                      disabled={isExtracting || isPaused}
                      className="w-full accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                      <span>0.1s</span>
                      <span>10s</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="fps"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <label className="text-sm text-slate-400 flex justify-between">
                      <span>Extract at</span>
                      <span className="text-emerald-400 font-medium">{fps} FPS</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      step="1"
                      value={fps}
                      onChange={(e) => setFps(parseInt(e.target.value))}
                      disabled={isExtracting || isPaused}
                      className="w-full accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                      <span>1</span>
                      <span>60</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </div>
        </div>

        {/* Right Column: Progress & Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 min-h-[300px] flex flex-col">
            {!file ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
                <RefreshCw size={48} strokeWidth={1} className="opacity-20" />
                <p>Upload a video to see extraction progress</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {/* Status Indicator */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {isExtracting ? 'Extracting Frames...' : isPaused ? 'Extraction Paused' : frames.length > 0 ? 'Extraction Complete' : 'Ready to Extract'}
                    </h3>
                    <p className="text-slate-400">
                      {frames.length} / {currentTotal || '?'} frames processed
                    </p>
                  </div>
                  {isExtracting && (
                    <div className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                    </div>
                  )}
                </div>

                {/* Estimate Section */}
                {!isExtracting && !isPaused && frames.length === 0 && (
                   <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                     <p className="text-sm text-slate-300 font-medium flex items-center justify-between">
                       <span>Estimated Total Output Size:</span>
                       {isEstimating ? (
                         <span className="text-slate-400 animate-pulse">Calculating...</span>
                       ) : (
                         <span className="text-teal-300 text-lg">{estimatedSize ? `~${formatFileSize(estimatedSize)}` : 'Unknown'}</span>
                       )}
                     </p>
                   </div>
                )}

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentTotal ? Math.min(100, (frames.length / currentTotal) * 100) : 0}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>{Math.round(currentTotal ? Math.min(100, (frames.length / currentTotal) * 100) : 0)}%</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-4 pt-4">
                  {!isExtracting && !isPaused && frames.length === 0 && (
                    <button
                      onClick={() => handleStartExtraction(false)}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Play size={20} className="fill-current" /> Start Extraction
                    </button>
                  )}
                  
                  {isExtracting && (
                    <button
                      onClick={pauseExtraction}
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Pause size={20} className="fill-current" /> Pause
                    </button>
                  )}

                  {isPaused && (
                    <button
                      onClick={() => handleStartExtraction(true)}
                      className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Play size={20} className="fill-current" /> Resume
                    </button>
                  )}

                  <button
                    onClick={handleDownload}
                    disabled={frames.length === 0 || isDownloading}
                    className={cn(
                      "flex-1 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95",
                      frames.length > 0
                        ? "bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30"
                        : "bg-slate-800 text-slate-600 cursor-not-allowed"
                    )}
                  >
                    {isDownloading ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                    {isDownloading ? 'Zipping...' : 'Download ZIP'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <PreviewGallery frames={frames} />
    </div>
  );
}
