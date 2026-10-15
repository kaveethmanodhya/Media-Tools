import JSZip from 'jszip';

export type ExportImageFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export function extensionFor(format: ExportImageFormat): string {
  return format === 'image/jpeg' ? 'jpg' : format.split('/')[1];
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'image';
}

export function readImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Cannot decode this image in your browser.'));
    };
    img.src = url;
  });
}

export function canvasBlob(canvas: HTMLCanvasElement, type: ExportImageFormat = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed.')), type, quality);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function downloadBatch(items: { name: string; blob: Blob }[], archiveName: string): Promise<void> {
  if (!items.length) throw new Error('No files to download.');
  if (items.length === 1) {
    downloadBlob(items[0].blob, items[0].name);
    return;
  }
  const zip = new JSZip();
  items.forEach(({name, blob}, index) => zip.file(String(index + 1).padStart(3, '0') + '-' + name, blob));
  downloadBlob(await zip.generateAsync({type:'blob', compression:'DEFLATE'}), archiveName);
}

export interface PdfImagePage {
  jpeg: Uint8Array;
  width: number;
  height: number;
  pageW: number;
  pageH: number;
  margin: number;
}

export function createImagePdf(pages: PdfImagePage[]): Blob {
  if (!pages.length) throw new Error('Add at least one image.');
  const encoder = new TextEncoder();
  const segments: Uint8Array[] = [];
  let byteCount = 0;
  const offsets: number[] = [0];
  const append = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    segments.push(bytes);
    byteCount += bytes.length;
  };
  const begin = (id: number) => {
    offsets[id] = byteCount;
    append(id + ' 0 obj\n');
  };
  append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  begin(1);
  append('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  begin(2);
  append('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>\nendobj\n');
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageId = 3 + i * 3, contentId = pageId + 1, imageId = pageId + 2;
    const scale = Math.min((p.pageW - 2 * p.margin) / p.width, (p.pageH - 2 * p.margin) / p.height);
    const w = p.width * scale, h = p.height * scale;
    const x = (p.pageW - w) / 2, y = (p.pageH - h) / 2;
    const draw = 'q\n' + w.toFixed(3) + ' 0 0 ' + h.toFixed(3) + ' ' + x.toFixed(3) + ' ' + y.toFixed(3) + ' cm\n/Im0 Do\nQ\n';
    const drawBytes = encoder.encode(draw);
    begin(pageId);
    append('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + p.pageW + ' ' + p.pageH + '] /Resources << /XObject << /Im0 ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>\nendobj\n');
    begin(contentId);
    append('<< /Length ' + drawBytes.length + ' >>\nstream\n');
    append(drawBytes);
    append('\nendstream\nendobj\n');
    begin(imageId);
    append('<< /Type /XObject /Subtype /Image /Width ' + p.width + ' /Height ' + p.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n');
    append(p.jpeg);
    append('\nendstream\nendobj\n');
  }
  const xrefOffset = byteCount, size = pages.length * 3 + 3;
  append('xref\n0 ' + size + '\n0000000000 65535 f \n');
  for (let i = 1; i < size; i++) append(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  append('trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');
  return new Blob(segments as BlobPart[], {type: 'application/pdf'});
}

/** A small fully local, no-dependency GIF89a writer. Uses a fixed 3-3-2 palette.
 * Literal LZW codes are periodically reset, favoring correctness over compression.
 */
export function createGif(frames: ImageData[], delayMs: number): Blob {
  if (frames.length < 2) throw new Error('A GIF needs at least two frames.');
  const w = frames[0].width, h = frames[0].height;
  if (w > 512 || h > 512 || w < 1 || h < 1 || frames.length > 40) throw new Error('GIF limit: 40 frames, at most 512×512 pixels.');
  if (frames.some(f => f.width !== w || f.height !== h)) throw new Error('Frame dimensions must match.');
  const parts: number[] = [];
  const byte = (v: number) => {parts.push(v & 255);};
  const word = (v: number) => {byte(v);byte(v >> 8);};
  const ascii = (s: string) => {for (let i = 0; i < s.length; i++) byte(s.charCodeAt(i));};
  ascii('GIF89a');
  word(w);word(h);byte(0xf7);byte(0);byte(0);
  for (let i = 0; i < 256; i++) {
    byte(Math.round(((i >> 5) & 7) * 255 / 7));
    byte(Math.round(((i >> 2) & 7) * 255 / 7));
    byte(Math.round((i & 3) * 255 / 3));
  }
  byte(0x21);byte(0xff);byte(11);ascii('NETSCAPE2.0');byte(3);byte(1);word(0);byte(0);
  for (const frame of frames) {
    byte(0x21);byte(0xf9);byte(4);byte(0x04);word(Math.max(2, Math.round(delayMs / 10)));byte(0);byte(0);
    byte(0x2c);word(0);word(0);word(w);word(h);byte(0);byte(8);
    let acc = 0, bitCount = 0;
    const data: number[] = [];
    const code = (value: number) => {
      acc |= value << bitCount;
      bitCount += 9;
      while (bitCount >= 8) { data.push(acc & 255); acc >>>= 8; bitCount -= 8; }
    };
    code(256);
    let sinceClear = 0;
    for (let i = 0; i < frame.data.length; i += 4) {
      const r = frame.data[i] >> 5, g = frame.data[i + 1] >> 5, b = frame.data[i + 2] >> 6;
      code((r << 5) | (g << 2) | b);
      sinceClear++;
      if (sinceClear === 180) {code(256); sinceClear = 0;}
    }
    code(257);
    if (bitCount > 0) data.push(acc & 255);
    for (let i = 0; i < data.length; i += 255) {
      const size = Math.min(255, data.length - i);
      byte(size);
      for (let j = 0; j < size; j++) byte(data[i + j]);
    }
    byte(0);
  }
  byte(0x3b);
  return new Blob([new Uint8Array(parts)], {type:'image/gif'});
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

export function drawContain(ctx: CanvasRenderingContext2D, img: CanvasImageSource, srcW: number, srcH: number, w: number, h: number) {
  const scale = Math.min(w / srcW, h / srcH);
  ctx.drawImage(img, (w - srcW * scale) / 2, (h - srcH * scale) / 2, srcW * scale, srcH * scale);
}
