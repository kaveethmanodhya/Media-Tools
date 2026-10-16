import type { Metadata } from 'next';
import { ImageUpscalerTool } from '@/components/CanvasTools';
export const metadata: Metadata = {
  title: 'AI Image Upscaler & Super-Resolution | MediaTools',
  description: 'Upscale low-resolution photos with edge-directed super-resolution, unsharp masking, and clarity enhancement. 100% private in-browser processing.'
};
export default function Page() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">AI Image Upscaler & Enhancer</h1>
        <p className="page-subtitle">Super-resolution clarity boost · Edge reconstruction · 100% private browser processing</p>
      </header>
      <main className="page-body">
        <ImageUpscalerTool />
      </main>
    </>
  );
}
