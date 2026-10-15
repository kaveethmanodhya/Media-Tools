# MediaTools — Complete Technical Documentation

> **Project:** MediaTools | Client-Side Media Processing Suite  
> **Author:** Kaveeth Manodhya  
> **Stack:** Next.js 16 (App Router), React 19, TypeScript, HTML5 Canvas, Web Workers, WebAssembly, Tailwind CSS  
> **Repository File:** `DOCUMENTATION.md`

---

## Table of Contents
1. [Project Overview & Philosophy](#1-project-overview--philosophy)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Deep-Dive Tool Specifications](#3-deep-dive-tool-specifications)
   - [3.1 Video-to-Frames Extractor](#31-video-to-frames-extractor)
   - [3.2 Sprite Sheet Maker](#32-sprite-sheet-maker)
   - [3.3 Bulk Image Converter & Resizer](#33-bulk-image-converter--resizer)
   - [3.4 AI Background Remover](#34-ai-background-remover)
   - [3.5 Canvas Color Filters](#35-canvas-color-filters)
4. [Client-Side Algorithms & Math](#4-client-side-algorithms--math)
   - [Average Hash (aHash) & Hamming Distance](#average-hash-ahash--hamming-distance)
   - [Probe Frame Size Estimation](#probe-frame-size-estimation)
   - [Multi-Pass Web Worker Compression](#multi-pass-web-worker-compression)
   - [Pixel-Math Matrix Filters](#pixel-math-matrix-filters)
5. [Memory Safety & Lifecycle Management](#5-memory-safety--lifecycle-management)
6. [Design System & Theme Tokens](#6-design-system--theme-tokens)
7. [Directory Structure](#7-directory-structure)
8. [Setup & Deployment Guide](#8-setup--deployment-guide)

---

## 1. Project Overview & Philosophy

**MediaTools** is built on the core principle of **Zero-Cloud Autonomy**:
1. **100% In-Browser Execution:** Videos, photos, and game sprites never leave the user's computer.
2. **Infinite Throughput:** Because no remote API or cloud GPU is queried, there are no rate limits, subscriptions, or wait queues.
3. **Hardware Acceleration:** Capitalizes on HTML5 Canvas, Web Workers, and WebAssembly (Wasm) to harness local multi-core CPUs and GPUs directly through browser APIs.

---

## 2. High-Level Architecture

```
[ User Input: Video / Image / Batch ]
                  │
                  ▼
         ┌──────────────────┐
         │ Navigation / App │  (Next.js 16 App Router)
         └────────┬─────────┘
                  │
  ┌───────────────┼───────────────┬───────────────┬───────────────┐
  ▼               ▼               ▼               ▼               ▼
/video-extractor /sprite-sheet  /image-converter  /bg-remover     /filters
  │               │               │               │               │
  │ HTML5 <video> │ Canvas 2D Grid│ browser-image │ @imgly/bg-rem │ Direct
  │ seek loop     │ Layout & UV   │ compression   │ ONNX Wasm     │ ImageData
  │ + aHash check │ JSON Atlas    │ (Web Worker)  │ Neural Net    │ Pixel Math
  ▼               ▼               ▼               ▼               ▼
[ Local Memory ] [ Local Memory ] [ Local Memory ] [ Local Memory ] [ Local Memory ]
  │               │               │               │               │
  └───────────────┴───────────────┼───────────────┴───────────────┘
                                  ▼
                         [ JSZip & FileSaver ]
                                  │
                                  ▼
                     [ Direct Local Download ]
```

---

## 3. Deep-Dive Tool Specifications

### 3.1 Video-to-Frames Extractor (`/video-extractor`)
- **Source Component:** [`src/components/AdvancedVideoExtractor.tsx`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/components/AdvancedVideoExtractor.tsx)
- **Engine Hook:** [`src/hooks/useVideoExtractor.ts`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/hooks/useVideoExtractor.ts)
- **Supported Video Formats:** `.mp4`, `.webm`, `.mov`, `.ogg`
- **Key Capabilities:**
  - **Dual-Handle Timeline Trimmer:** Uses an interactive slider to set start and end timestamps in seconds, restricting extraction to a sub-clip.
  - **Aspect Ratio Cropping:** In-memory canvas cropping presets (`1:1`, `16:9`, `9:16`, `Free`). Crops directly on the extraction canvas before encoding.
  - **Pre-Extraction Size Estimation:** Automatically takes a single test frame at the start timestamp, encodes it to WebP at 75% quality, calculates its exact byte size, and calculates `Estimated Size = probeFrameSize * projectedFrameCount`.
  - **aHash Duplicate Rejection:** Analyzes each frame's 8×8 grayscale downsampled average hash. If the Hamming distance between consecutive frames is $\le 2$, the frame is dropped as a duplicate (preventing duplicate frames during paused or low-motion sequences).
  - **Memory Safeguards:** Tracks all generated object URLs in a persistent ref and calls `URL.revokeObjectURL()` on reset, cancel, or completion.

### 3.2 Sprite Sheet Maker (`/sprite-sheet`)
- **Source Component:** [`src/components/SpritesheetMaker.tsx`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/components/SpritesheetMaker.tsx)
- **Input:** Extracted frame sequences or custom multi-image uploads.
- **Key Capabilities:**
  - **Grid Configuration:** Customize column count, max cell dimensions (width/height), and cell padding in pixels.
  - **Composite Canvas Assembly:** Iterates through images, computes coordinates:
    $$\text{col} = i \pmod{\text{columns}}, \quad \text{row} = \lfloor i / \text{columns} \rfloor$$
    $$x = \text{col} \times (\text{cellW} + \text{padding}), \quad y = \text{row} \times (\text{cellH} + \text{padding})$$
  - **Export Options:**
    1. Composite sheet image in **WebP** or **PNG**.
    2. Accompanying **JSON Atlas**:
       ```json
       {
         "frames": {
           "frame_0.webp": { "x": 0, "y": 0, "w": 128, "h": 72 },
           "frame_1.webp": { "x": 128, "y": 0, "w": 128, "h": 72 }
         },
         "meta": {
           "size": { "w": 256, "h": 72 }
         }
       }
       ```

### 3.3 Bulk Image Converter & Resizer (`/image-converter`)
- **Source Component:** [`src/components/BulkImageConverter.tsx`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/components/BulkImageConverter.tsx)
- **Underlying Engine:** `browser-image-compression` running inside a Web Worker.
- **Input Formats:** JPEG, PNG, WebP, GIF, BMP.
- **Output Formats:** WebP, PNG, JPEG.
- **Key Parameters:**
  - `maxSizeMB`: Bounded target size (presets: `0.3MB`, `0.5MB`, `0.8MB (Default)`, `1.0MB`, `2.0MB` or custom slider). The engine iteratively optimizes quality to fit this budget.
  - `maxWidthOrHeight`: Dimension cap (presets: `1920 (FHD)`, `1280 (HD)`, `800 (Web)`, `Original`). Scales images down proportionally.
  - `useWebWorker: true`: Prevents main-thread UI freezing during multi-pass compression passes.
  - `alwaysKeepResolution: false`: Allows intelligent downsampling when images exceed target byte thresholds.
  - `initialQuality`: Default 75% (`0.75`).
- **Live Size Delta UI:** Shows `Before: X MB → After: Y KB (-Z% Saved)` with green/red badges and target attainment tags.

### 3.4 AI Background Remover (`/bg-remover`)
- **Source Component:** [`src/components/BgRemover.tsx`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/components/BgRemover.tsx)
- **Engine Module:** [`src/lib/bgRemovalEngine.ts`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/lib/bgRemovalEngine.ts)
- **Acceleration & Models:**
  - **WebGPU Shader Acceleration:** Auto-detects `navigator.gpu` to run ONNX compute shaders on the GPU (10x–20x speedup over CPU). Gracefully falls back to multi-threaded CPU WASM when WebGPU is unavailable.
  - **IS-Net Multi-Precision Presets:**
    - `Ultra Quality (IS-Net FP32)`: Full 32-bit floating point precision neural weights for maximum edge fidelity, hair strand separation, and intricate silhouettes.
    - `Balanced (IS-Net FP16)`: 16-bit half precision model providing fast execution and sharp boundaries.
    - `Turbo Fast (IS-Net INT8)`: 8-bit quantized model for rapid real-time frame sequences.
  - **Studio Edge Matting & De-fringing:**
    - Custom Canvas 2D alpha feathering and smoothing algorithm to eliminate jagged stair-stepping.
    - Alpha thresholding de-noiser to remove stray background speckles.
    - Color spill de-fringing to neutralize background color halos on subject boundaries.
  - **Dual Input Modes:** Supports single/batch images or direct video-to-transparent-frames extraction.
  - **Interactive Inspection:** Real-time split comparison slider and multi-backdrop simulator (Checkerboard, Pure White, Pure Black, Studio Green, Custom Color).

### 3.5 Canvas Color Filters (`/filters`)
- **Source Component:** [`src/components/CanvasColorFilters.tsx`](file:///Users/kaveethmanodhya/Desktop/Projects/vid%20to%20frames/src/components/CanvasColorFilters.tsx)
- **Engine:** Direct pixel manipulation using `ctx.getImageData()` and `ctx.putImageData()`.
- **Supported Filters:**
  - **Grayscale:** Standard NTSC luminance weighting.
  - **Invert:** Pixel value bitwise inversion.
  - **High Contrast:** Sigmoid S-curve pixel scaling.
  - **Sepia:** Classic photographic toning transformation matrix.
  - **Warm / Cool:** Color balance channel temperature biasing.

---

## 4. Client-Side Algorithms & Math

### Average Hash (aHash) & Hamming Distance
Used in `/video-extractor` to drop static/duplicate frames:
1. Downscale the current frame to an $8 \times 8$ grayscale canvas ($64$ pixels total).
2. Calculate the mean pixel intensity:
   $$\mu = \frac{1}{64} \sum_{i=0}^{63} P_i$$
3. Generate a 64-bit binary hash where bit $i$ is $1$ if $P_i \ge \mu$, otherwise $0$:
   $$H_i = \begin{cases} 1 & \text{if } P_i \ge \mu \\ 0 & \text{if } P_i < \mu \end{cases}$$
4. Calculate the **Hamming Distance** between consecutive frame hashes $H_A$ and $H_B$:
   $$D_H(H_A, H_B) = \text{popcount}(H_A \oplus H_B)$$
   If $D_H \le 2$, the frame is considered a duplicate and dropped.

### Probe Frame Size Estimation
Before launching a bulk extraction of hundreds of frames:
$$\text{Probe Size} = \text{byteSize}(\text{sampleFrame}(\text{startTime}))$$
$$\text{Projected Total Size} = \text{Probe Size} \times \left(\frac{\text{endTime} - \text{startTime}}{\text{interval}}\right)$$

### Pixel-Math Matrix Filters
- **Luminance:**
  $$Y = 0.299R + 0.587G + 0.114B$$
- **Sepia Matrix:**
  $$R' = \min(255, 0.393R + 0.769G + 0.189B)$$
  $$G' = \min(255, 0.349R + 0.686G + 0.168B)$$
  $$B' = \min(255, 0.272R + 0.534G + 0.131B)$$
- **Contrast S-Curve:**
  $$C' = 128 + (C - 128) \times \text{factor}$$

---

## 5. Memory Safety & Lifecycle Management

Processing large video files and high-resolution images in browser memory requires strict lifecycle cleanup:
- **Object URL Revocation:** Whenever a frame, image, or ZIP Blob is created via `URL.createObjectURL(blob)`, its URL is stored in a tracking cache (`fileMap` or `urlsRef`). When items are deleted or cleared, `URL.revokeObjectURL(url)` is invoked immediately to free browser heap space.
- **Worker Cleanups:** Background compression tasks utilize disposable instances to prevent memory accumulation across conversion queues.
- **Bitmap Closure:** `ImageBitmap` instances created with `createImageBitmap()` explicitly call `bitmap.close()` immediately after dimension querying.

---

## 6. Design System & Theme Tokens

The application follows a curated, professional SaaS theme:
- **Neutral Charcoal Surfaces:** `#141414` (Deep background), `#1f1f1f` (Card surface), `#2a2a2a` (Elevated components)
- **Charcoal Neutral Borders:** `#393939`
- **Flame Orange Accent (Primary):** `#FF5A09` (Primary buttons, active states, brand emblem)
- **Warm Amber Accent (Secondary):** `#ec7f37` (Hover states, subtle borders)
- **Burnished Rust Accent:** `#be4f0c` (Sliders, active indicators)
- **Typography:** `Inter` for UI components, `JetBrains Mono` for technical readouts and byte statistics.

---

## 7. Directory Structure

```
├── public/
│   ├── logo.png                   # High-resolution 512x512 brand logo
│   ├── favicon.ico                # Root favicon
│   ├── favicon-32x32.png          # 32px favicon
│   ├── favicon-16x16.png          # 16px favicon
│   ├── apple-touch-icon.png       # Apple touch icon
│   ├── android-chrome-192x192.png # PWA 192px icon
│   ├── android-chrome-512x512.png # PWA 512px icon
│   └── site.webmanifest           # App manifest
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout & metadata
│   │   ├── page.tsx               # Home landing page
│   │   ├── globals.css            # Design tokens & component styles
│   │   ├── video-extractor/page.tsx # Video-to-Frames route
│   │   ├── sprite-sheet/page.tsx    # Sprite Sheet Maker route
│   │   ├── image-converter/page.tsx # Bulk Image Converter route
│   │   ├── bg-remover/page.tsx      # AI Background Remover route
│   │   └── filters/page.tsx         # Color Filters route
│   ├── components/
│   │   ├── Navbar.tsx             # Sticky top header with /logo.png
│   │   ├── Footer.tsx             # Footer with author credits
│   │   ├── AdvancedVideoExtractor.tsx # Video extractor component
│   │   ├── SpritesheetMaker.tsx   # Sprite sheet component
│   │   ├── BulkImageConverter.tsx # Advanced image compression component
│   │   ├── BgRemover.tsx          # Local AI background remover
│   │   └── CanvasColorFilters.tsx # Pixel math color filter component
│   ├── hooks/
│   │   ├── useVideoExtractor.ts   # Video seek, frame loop, and aHash
│   │   └── useBulkConverter.ts    # Batch compression hook
│   └── lib/
│       ├── videoUtils.ts          # aHash calculations and frame sampling
│       ├── utils.ts               # File size formatters
│       └── zipUtils.ts            # JSZip packaging
├── DOCUMENTATION.md               # Detailed technical documentation
├── README.md                      # Overview and quick-start guide
└── package.json
```

---

## 8. Setup & Deployment Guide

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
Navigate to `http://localhost:3000`.

### Production Build
```bash
npm run build
npm run start
```
All routes are pre-rendered statically as zero-server static pages.

---

*Documentation maintained by Kaveeth Manodhya. All media processing occurs on the client device.*
