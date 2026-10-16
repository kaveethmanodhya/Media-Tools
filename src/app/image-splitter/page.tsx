import type { Metadata } from 'next';
import { ImageSplitterTool } from '@/components/ImageSplitterTool';

export const metadata: Metadata = {
  title: 'Image Splitter & Grid Cutter | MediaTools',
  description:
    'Cut and split images into parts, grids, rows, columns, or Instagram 3×3 feeds and seamless panorama swipe carousels. Download individual parts or all in a single ZIP.',
};

export default function SplitterPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Image Splitter & Grid Cutter</h1>
        <p className="page-subtitle">
          Slice photos into grid tiles or swipe carousels · Visual cutting guide · Download all as ZIP · 100% private
        </p>
      </header>
      <main className="page-body">
        <ImageSplitterTool />
      </main>
    </>
  );
}
