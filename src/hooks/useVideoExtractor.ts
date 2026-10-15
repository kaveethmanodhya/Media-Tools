import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ExtractedFrame,
  ExtractionOptions,
  extractFramesGenerator,
  getVideoMetadata,
} from '@/lib/videoUtils';

export interface UseVideoExtractorReturn {
  frames: ExtractedFrame[];
  setFrames: React.Dispatch<React.SetStateAction<ExtractedFrame[]>>;
  isExtracting: boolean;
  isPaused: boolean;
  progress: number;
  totalEstimated: number;
  startExtraction: (
    file: File,
    options: ExtractionOptions,
    resume?: boolean
  ) => Promise<void>;
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
  const framesRef = useRef<ExtractedFrame[]>([]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      framesRef.current.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);

  const resetState = useCallback(() => {
    shouldCancelRef.current = true;
    setFrames((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return [];
    });
    setProgress(0);
    setTotalEstimated(0);
    setIsExtracting(false);
    setIsPaused(false);
  }, []);

  const pauseExtraction = useCallback(() => {
    shouldPauseRef.current = true;
  }, []);

  const startExtraction = useCallback(
    async (file: File, options: ExtractionOptions, resume: boolean = false) => {
      let startIndex = 0;

      if (resume) {
        startIndex = framesRef.current.length;
      } else {
        setFrames((prev) => {
          prev.forEach((f) => {
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
        const clampedEnd = Math.min(options.endTime, metadata.duration);
        const clampedStart = Math.max(options.startTime, 0);
        const duration = clampedEnd - clampedStart;
        const estimated = Math.max(1, Math.ceil(duration / options.stepSeconds));
        setTotalEstimated(estimated);

        const generator = extractFramesGenerator(file, options, startIndex);

        for await (const frame of generator) {
          if (shouldCancelRef.current) break;
          if (shouldPauseRef.current) {
            setIsPaused(true);
            setIsExtracting(false);
            break;
          }

          const enhanced: ExtractedFrame = {
            ...frame,
            previewUrl: URL.createObjectURL(frame.blob),
          };

          setFrames((prev) => [...prev, enhanced]);
          setProgress(enhanced.number);
        }

        if (!shouldPauseRef.current && !shouldCancelRef.current) {
          setIsExtracting(false);
        }
      } catch (error) {
        console.error('Extraction failed:', error);
        alert('An error occurred during extraction. Please try again.');
        setIsExtracting(false);
      }
    },
    []
  );

  return {
    frames,
    setFrames,
    isExtracting,
    isPaused,
    progress,
    totalEstimated,
    startExtraction,
    pauseExtraction,
    resetState,
  };
}
