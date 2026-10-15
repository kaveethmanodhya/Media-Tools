import JSZip from 'jszip';
import { recordDownload } from './usageClient';
import { ExtractedFrame } from './videoUtils';

export interface ZipOptions {
  namingPattern: string; // e.g. "frame_{index}" or "asset_{index}"
  subfolder: string;     // e.g. "frames" — inner folder in ZIP
  onProgress?: (percent: number) => void;
}

/**
 * Resolve the file name for a frame using a naming pattern.
 * Supported tokens: {index}, {timestamp}, {number}
 */
function resolveFileName(pattern: string, frame: ExtractedFrame): string {
  return pattern
    .replace('{index}', frame.number.toString().padStart(4, '0'))
    .replace('{number}', frame.number.toString())
    .replace('{timestamp}', frame.timestamp.toFixed(3).replace('.', '_'));
}

export async function downloadFramesAsZip(
  frames: ExtractedFrame[],
  baseFilename: string,
  options?: Partial<ZipOptions>
): Promise<void> {
  const namingPattern = options?.namingPattern?.trim() || 'frame_{index}';
  const subfolder = options?.subfolder?.trim() || baseFilename;
  const onProgress = options?.onProgress;

  const zip = new JSZip();
  const folder = zip.folder(subfolder);
  if (!folder) throw new Error('Failed to create ZIP folder');

  const active = frames.filter((f) => !f.deleted);

  active.forEach((frame) => {
    const filename = `${resolveFileName(namingPattern, frame)}.${frame.extension}`;
    folder.file(filename, frame.blob);
  });

  const content = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } },
    (meta) => {
      if (onProgress) onProgress(Math.round(meta.percent));
    }
  );

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${subfolder}.zip`;
  document.body.appendChild(a);
  a.click();
  recordDownload();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
