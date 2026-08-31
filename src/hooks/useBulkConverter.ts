import { useState, useRef, useCallback, useEffect } from 'react';
import { ExtractedFrame, ResolutionMode } from '@/lib/videoUtils';

export interface UseBulkConverterReturn {
  frames: ExtractedFrame[];
  isConverting: boolean;
  isPaused: boolean;
  progress: number;
  totalFiles: number;
  startConversion: (files: File[], quality: number, resolution: ResolutionMode, resume?: boolean) => Promise<void>;
  pauseConversion: () => void;
  resetState: () => void;
}

export function useBulkConverter(): UseBulkConverterReturn {
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const shouldPauseRef = useRef(false);
  const shouldCancelRef = useRef(false);

  const pendingFilesRef = useRef<File[]>([]);

  const resetState = useCallback(() => {
    setFrames(prevFrames => {
      prevFrames.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return [];
    });
    setProgress(0);
    setTotalFiles(0);
    setIsConverting(false);
    setIsPaused(false);
    shouldCancelRef.current = true;
    pendingFilesRef.current = [];
  }, []);

  const framesRef = useRef<ExtractedFrame[]>([]);
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    return () => {
      framesRef.current.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);

  const pauseConversion = useCallback(() => {
    shouldPauseRef.current = true;
  }, []);

  const startConversion = useCallback(async (
    files: File[], 
    quality: number, 
    resolution: ResolutionMode, 
    resume: boolean = false
  ) => {
    
    if (!resume) {
      setFrames(prevFrames => {
        prevFrames.forEach(f => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        return [];
      });
      setProgress(0);
      setTotalFiles(files.length);
      pendingFilesRef.current = [...files];
    }

    setIsConverting(true);
    setIsPaused(false);
    shouldPauseRef.current = false;
    shouldCancelRef.current = false;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Failed to get canvas 2d context');

      let MAX_WIDTH: number | null = null;
      switch (resolution) {
        case '1080p (FHD)': MAX_WIDTH = 1920; break;
        case '720p (HD)': MAX_WIDTH = 1280; break;
        case '480p': MAX_WIDTH = 854; break;
        case 'Original': default: MAX_WIDTH = null; break;
      }

      while (pendingFilesRef.current.length > 0) {
        if (shouldCancelRef.current) break;
        if (shouldPauseRef.current) {
          setIsPaused(true);
          setIsConverting(false);
          break;
        }

        const currentFile = pendingFilesRef.current.shift()!;
        const currentNumber = totalFiles - pendingFilesRef.current.length;

        // Load image
        const img = await createImageBitmap(currentFile);
        
        let canvasWidth = img.width;
        let canvasHeight = img.height;

        if (MAX_WIDTH && canvasWidth > MAX_WIDTH) {
          canvasHeight = Math.round((MAX_WIDTH / canvasWidth) * canvasHeight);
          canvasWidth = MAX_WIDTH;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/webp', quality);
        });

        if (blob) {
          const enhancedFrame: ExtractedFrame = {
            id: crypto.randomUUID(),
            number: currentNumber,
            timestamp: 0, // N/A for images
            blob,
            size: blob.size,
            previewUrl: URL.createObjectURL(blob),
            extension: 'webp'
          };

          setFrames(prev => [...prev, enhancedFrame]);
          setProgress(currentNumber);
        }
        
        img.close();
      }

      if (!shouldPauseRef.current && !shouldCancelRef.current) {
        setIsConverting(false);
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      alert('An error occurred during conversion. Please try again.');
      setIsConverting(false);
    }
  }, [totalFiles]);

  return {
    frames,
    isConverting,
    isPaused,
    progress,
    totalFiles,
    startConversion,
    pauseConversion,
    resetState
  };
}
