import type { Metadata } from "next";
import { AdvancedVideoExtractor } from "@/components/AdvancedVideoExtractor";

export const metadata: Metadata = {
  title: "Video → Frames Extractor",
  description:
    "Extract high-quality WebP frames from videos with timeline trimming, aspect ratio cropping, duplicate removal, and advanced ZIP export — entirely in your browser.",
};

export default function VideoExtractorPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Advanced Video → Frames Extractor</h1>
        <p className="page-subtitle">
          Timeline trimming · Crop presets · Duplicate removal · Frame culler · Custom ZIP export
        </p>
      </header>
      <main className="page-body">
        <AdvancedVideoExtractor />
      </main>
    </>
  );
}
