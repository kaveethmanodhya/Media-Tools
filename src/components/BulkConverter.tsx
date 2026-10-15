'use client';

import React, { useState, useRef } from 'react';
import { Download, RefreshCw, X, Image as ImageIcon, UploadCloud, Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';
import { downloadFramesAsZip } from '@/lib/zipUtils';
import { PreviewGallery } from './PreviewGallery';
import { formatFileSize } from '@/lib/utils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useBulkConverter } from '@/hooks/useBulkConverter';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function BulkConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    frames,
    isConverting,
    isPaused,
    progress,
    totalFiles,
    startConversion,
    pauseConversion,
    resetState: resetHookState,
  } = useBulkConverter();
  
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(Array.from(e.dataTransfer.files));
    }
  };

  const handleFilesSelect = (selectedFiles: File[]) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validFiles = selectedFiles.filter(f => validTypes.includes(f.type));
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      resetHookState();
    } else {
      alert('Please upload valid image files (.jpg, .jpeg, .png, .webp)');
    }
  };

  const resetState = () => {
    setFiles([]);
    resetHookState();
  };

  const handleStartConversion = (resume: boolean = false) => {
    if (files.length > 0) {
      startConversion(files, resume);
    }
  };

  const handleDownload = async () => {
    if (frames.length === 0) return;
    setIsDownloading(true);
    try {
      await downloadFramesAsZip(frames, 'bulk_converted');
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to create ZIP file.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 tracking-tight">
          Bulk<span className="text-white">Convert</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Compress and convert hundreds of JPG/PNG images to optimized WebP formats directly in your browser.
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
              files.length > 0 ? "border-emerald-500/50" : ""
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {files.length > 0 ? (
              <div className="w-full text-center space-y-4 relative z-10">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-4">
                  <ImageIcon size={32} />
                </div>
                <div>
                  <p className="text-emerald-400 font-medium truncate px-4">{files.length} Files Selected</p>
                  <p className="text-slate-400 text-sm mt-1">Total: {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))}</p>
                </div>
                <button
                  onClick={resetState}
                  className="mt-4 px-4 py-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center justify-center mx-auto gap-2"
                >
                  <X size={16} /> Clear All
                </button>
              </div>
            ) : (
              <div className="text-center relative z-10 pointer-events-none">
                <div className="mx-auto w-20 h-20 bg-slate-800 rounded-3xl shadow-inner flex items-center justify-center text-slate-400 mb-6 group-hover:scale-110 group-hover:text-emerald-400 transition-all duration-300">
                  <UploadCloud size={40} strokeWidth={1.5} />
                </div>
                <p className="text-lg font-medium text-white mb-2">Drag & Drop Images</p>
                <p className="text-sm text-slate-400">Supports .jpg, .jpeg, .png</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className={cn("absolute inset-0 w-full h-full opacity-0 z-20", files.length === 0 ? "cursor-pointer" : "cursor-default pointer-events-none")}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesSelect(Array.from(e.target.files));
                }
              }}
            />
          </div>
        </div>

        {/* Right Column: Progress & Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 min-h-[300px] flex flex-col">
            {files.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
                <RefreshCw size={48} strokeWidth={1} className="opacity-20" />
                <p>Upload images to see conversion progress</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {/* Status Indicator */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {isConverting ? 'Converting Images...' : isPaused ? 'Conversion Paused' : frames.length > 0 && frames.length === files.length ? 'Conversion Complete' : 'Ready to Convert'}
                    </h3>
                    <p className="text-slate-400">
                      {frames.length} / {files.length} images processed
                    </p>
                  </div>
                  {isConverting && (
                    <div className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (frames.length / files.length) * 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>{Math.round(Math.min(100, (frames.length / files.length) * 100))}%</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-4 pt-4">
                  {!isConverting && !isPaused && frames.length < files.length && (
                    <button
                      onClick={() => handleStartConversion(false)}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Play size={20} className="fill-current" /> Start Conversion
                    </button>
                  )}
                  
                  {isConverting && (
                    <button
                      onClick={pauseConversion}
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Pause size={20} className="fill-current" /> Pause
                    </button>
                  )}

                  {isPaused && (
                    <button
                      onClick={() => handleStartConversion(true)}
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
