import type { Metadata } from "next";
import { SpritesheetMaker } from "@/components/SpritesheetMaker";

export const metadata: Metadata = {
  title: "Sprite Sheet Maker",
  description: "Pack extracted frames into a single WebP sprite sheet with a JSON coordinate map — 100% client-side.",
};

export default function SpritesheetPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Sprite Sheet Maker</h1>
        <p className="page-subtitle">
          Pack frames into a grid · Export WebP + JSON coordinate map
        </p>
      </header>
      <main className="page-body">
        <SpritesheetMaker />
      </main>
    </>
  );
}
