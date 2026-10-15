import type { Metadata } from "next";
import { BgRemover } from "@/components/BgRemover";

export const metadata: Metadata = {
  title: "AI Background Remover",
  description: "Remove image backgrounds entirely offline using an ONNX neural network model — no uploads, no API keys, 100% private.",
};

export default function BgRemoverPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">AI Background Remover</h1>
        <p className="page-subtitle">
          ONNX neural network · 100% offline · Transparent PNG / WebP export
        </p>
      </header>
      <main className="page-body">
        <BgRemover />
      </main>
    </>
  );
}
