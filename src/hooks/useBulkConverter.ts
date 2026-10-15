import { useState, useRef, useCallback, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { ExtractedFrame } from '@/lib/videoUtils';

export interface UseBulkConverterReturn {
  frames: ExtractedFrame[];
  isConverting: boolean;
  isPaused: boolean;
  progress: number;
  totalFiles: number;
  startConversion: (files: File[], resume?: boolean) => Promise<void>;
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
      while (pendingFilesRef.current.length > 0) {
        if (shouldCancelRef.current) break;
        if (shouldPauseRef.current) {
          setIsPaused(true);
          setIsConverting(false);
          break;
        }

        const currentFile = pendingFilesRef.current.shift()!;
        const currentNumber = totalFiles - pendingFilesRef.current.length;

        // Advanced client-side Web Worker compression
        const compressedFile = await imageCompression(currentFile, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/webp',
          alwaysKeepResolution: false,
          initialQuality: 0.75,
        });

        const enhancedFrame: ExtractedFrame = {
          id: crypto.randomUUID(),
          number: currentNumber,
          timestamp: 0, // N/A for images
          blob: compressedFile,
          size: compressedFile.size,
          previewUrl: URL.createObjectURL(compressedFile),
          extension: 'webp'
        };

        setFrames(prev => [...prev, enhancedFrame]);
        setProgress(currentNumber);
        
        // Prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 0));
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
