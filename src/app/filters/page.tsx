import type { Metadata } from "next";
import { CanvasColorFilters } from "@/components/CanvasColorFilters";

export const metadata: Metadata = {
  title: "Canvas Color Filters",
  description: "Apply pixel-level mathematical color filters to images — Invert, Grayscale, High Contrast, Sepia, Warm, and Cool — using HTML5 Canvas getImageData.",
};

export default function FiltersPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Canvas Color Filters</h1>
        <p className="page-subtitle">
          Pixel-math filters via ctx.getImageData() · Adjustable intensity · Export PNG
        </p>
      </header>
      <main className="page-body">
        <CanvasColorFilters />
      </main>
    </>
  );
}
