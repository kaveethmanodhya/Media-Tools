import { useState, useRef, useCallback, useEffect } from 'react';
import { ExtractedFrame, extractFramesGenerator, getVideoMetadata, ResolutionMode, OutputFormat } from '@/lib/videoUtils';

export interface UseVideoExtractorReturn {
  frames: ExtractedFrame[];
  isExtracting: boolean;
  isPaused: boolean;
  progress: number;
  totalEstimated: number;
  startExtraction: (file: File, mode: 'seconds' | 'fps', intervalValue: number, quality: number, resolution: ResolutionMode, format: OutputFormat, resume?: boolean) => Promise<void>;
  pauseExtraction: () => void;
  resetState: () => void;
}

export function useVideoExtractor(): UseVideoExtractorReturn {
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalEstimated, setTotalEstimated] = useState(0);

  const shouldPauseRef = useRef(false);
  const shouldCancelRef = useRef(false);

  const resetState = useCallback(() => {
    setFrames(prevFrames => {
      prevFrames.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return [];
    });
    setProgress(0);
    setTotalEstimated(0);
    setIsExtracting(false);
    setIsPaused(false);
    shouldCancelRef.current = true;
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

  const pauseExtraction = useCallback(() => {
    shouldPauseRef.current = true;
  }, []);

  const startExtraction = useCallback(async (file: File, mode: 'seconds' | 'fps', intervalValue: number, quality: number, resolution: ResolutionMode, format: OutputFormat, resume: boolean = false) => {
    let startIndex = 0;
    if (resume) {
      startIndex = frames.length;
    } else {
      setFrames(prevFrames => {
        prevFrames.forEach(f => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        return [];
      });
      setProgress(0);
    }

    setIsExtracting(true);
    setIsPaused(false);
    shouldPauseRef.current = false;
    shouldCancelRef.current = false;

    try {
      const metadata = await getVideoMetadata(file);
      const stepSeconds = mode === 'seconds' ? intervalValue : 1 / intervalValue;
      const estimated = Math.ceil(metadata.duration / stepSeconds);
      setTotalEstimated(estimated);

      const generator = extractFramesGenerator(file, stepSeconds, quality, resolution, format, startIndex);

      for await (const frame of generator) {
        if (shouldCancelRef.current) break;
        if (shouldPauseRef.current) {
          setIsPaused(true);
          setIsExtracting(false);
          break;
        }

        // Add a previewUrl property if we want to store it in local state.
        // But to keep it simple, we use the ExtractedFrame from videoUtils.
        // Generating preview URL directly here:
        const enhancedFrame = {
          ...frame,
          previewUrl: URL.createObjectURL(frame.blob)
        };

        setFrames(prev => [...prev, enhancedFrame]);
        setProgress(enhancedFrame.number);
      }

      if (!shouldPauseRef.current && !shouldCancelRef.current) {
        setIsExtracting(false);
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      alert('An error occurred during extraction. Please try again.');
      setIsExtracting(false);
    }
  }, [frames.length]);

  return {
    frames,
    isExtracting,
    isPaused,
    progress,
    totalEstimated,
    startExtraction,
    pauseExtraction,
    resetState
  };
}
