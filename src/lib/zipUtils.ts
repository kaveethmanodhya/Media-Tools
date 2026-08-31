import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ExtractedFrame } from './videoUtils';

export async function downloadFramesAsZip(frames: ExtractedFrame[], baseFilename: string) {
  const zip = new JSZip();
  
  // Create a folder inside the zip
  const timestamp = Date.now();
  const folderName = `extracted_frames_${timestamp}`;
  const folder = zip.folder(folderName);
  
  if (!folder) throw new Error('Failed to create zip folder');

  // Add all frame blobs to the zip
  frames.forEach((frame) => {
    const filename = `frame_${frame.number.toString().padStart(4, '0')}.${frame.extension}`;
    folder.file(filename, frame.blob);
  });

  // Generate zip file
  const content = await zip.generateAsync({ type: 'blob' });
  
  // Trigger download
  saveAs(content, `${folderName}.zip`);
}
