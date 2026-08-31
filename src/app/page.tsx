'use client';

import { useState } from 'react';
import { VideoExtractor } from '@/components/VideoExtractor';
import { BulkConverter } from '@/components/BulkConverter';
import { Video, Image as ImageIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'video' | 'bulk'>('video');

  return (
    <main className="min-h-screen relative overflow-hidden bg-gray-950 font-sans antialiased text-slate-100 flex flex-col items-center py-12 md:py-24 px-4 md:px-8">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      
      {/* Noise overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
      
      <div className="w-full z-10 relative space-y-8 flex flex-col items-center">
        
        {/* Navigation Tabs */}
        <div className="flex bg-gray-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-gray-800 shadow-xl max-w-md w-full mx-auto relative z-20">
          <button
            onClick={() => setActiveTab('video')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300",
              activeTab === 'video' 
                ? "bg-gray-800 text-white shadow-md border border-gray-700" 
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
          >
            <Video size={18} />
            Video to Frames
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300",
              activeTab === 'bulk' 
                ? "bg-gray-800 text-white shadow-md border border-gray-700" 
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
          >
            <ImageIcon size={18} />
            Bulk WebP Converter
          </button>
        </div>

        <div className="w-full">
          {activeTab === 'video' ? <VideoExtractor /> : <BulkConverter />}
        </div>
      </div>
    </main>
  );
}
