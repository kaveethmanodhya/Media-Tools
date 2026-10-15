import type { Metadata } from "next";
import { BulkImageConverter } from "@/components/BulkImageConverter";

export const metadata: Metadata = {
  title: "Bulk Image Converter & Resizer",
  description: "Convert PNG, JPEG, and WebP images in bulk, resize dimensions, and compare before/after file sizes — entirely in the browser.",
};

export default function ImageConverterPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Bulk Image Converter & Resizer</h1>
        <p className="page-subtitle">
          PNG · JPEG · WebP · Quality slider · Resize · Before/after size comparison
        </p>
      </header>
      <main className="page-body">
        <BulkImageConverter />
      </main>
    </>
  );
}
