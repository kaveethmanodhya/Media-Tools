import type { Metadata } from 'next';
import { ImageBlurTool } from '@/components/ImageBlurTool';

export const metadata: Metadata = {
  title: 'Image Blur & Privacy Censor | MediaTools',
  description:
    'Blur full images or censor sensitive faces, license plates, credit cards, and confidential text with Gaussian blur or pixelate mosaic. 100% private in-browser processing.',
};

export default function BlurPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Image Blur & Privacy Censor</h1>
        <p className="page-subtitle">
          Gaussian blur & pixelate mosaic · Draggable privacy censor masks · Bokeh portrait mode · 100% client-side
        </p>
      </header>
      <main className="page-body">
        <ImageBlurTool />
      </main>
    </>
  );
}
