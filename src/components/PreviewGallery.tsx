'use client';

import React from 'react';
import { ExtractedFrame } from '@/lib/videoUtils';
import { formatFileSize, formatTime } from '@/lib/utils';
import { motion } from 'framer-motion';

export function PreviewGallery({ frames }: { frames: ExtractedFrame[] }) {
  if (frames.length === 0) return null;

  return (
    <div className="mt-8 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Preview Gallery</h3>
        <span className="text-sm text-slate-400">{frames.length} frames extracted</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {frames.map((frame, index) => (
          <FrameItem key={frame.id} frame={frame} index={index} />
        ))}
      </div>
    </div>
  );
}

function FrameItem({ frame, index }: { frame: ExtractedFrame; index: number }) {
  const url = frame.previewUrl || '';

  if (!url) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      // Cap delay so it doesn't wait forever for hundreds of frames
      transition={{ delay: Math.min(index * 0.05, 1) }}
      className="relative group overflow-hidden rounded-xl bg-slate-800/50 border border-slate-700/50 shadow-lg hover:shadow-xl hover:border-slate-600 transition-all duration-300"
    >
      <img src={url} alt={`Frame ${frame.number}`} className="w-full h-auto object-cover aspect-video bg-black" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
        <div className="p-3">
          <p className="text-white text-sm font-medium">Frame {frame.number}</p>
          <div className="flex justify-between items-center text-xs text-slate-300 mt-1">
            <span>{formatTime(frame.timestamp)}</span>
            <span>{formatFileSize(frame.size)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
