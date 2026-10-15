import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is used by default in Next.js 16.
  // The ONNX runtime WASM files are self-contained and don't need extra config.
  turbopack: {},
};

export default nextConfig;
