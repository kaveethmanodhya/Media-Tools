# MediaTools — 100% Client-Side Media Processing Suite

<p align="center">
  <img src="public/logo.png" alt="MediaTools Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Fast, Private, Hardware-Accelerated Browser Media Suite</strong><br>
  Built with Next.js 16 (App Router), React, HTML5 Canvas, WebAssembly, Web Workers, and Tailwind CSS.
</p>

<p align="center">
  <a href="#tools--features">Tools & Features</a> •
  <a href="#architecture--privacy-model">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#design-system">Design System</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a>
</p>

---

## Overview

**MediaTools** is a production-grade, 100% client-side media manipulation suite. All video frame extraction, sprite packing, image format conversion, neural background removal, and color filtering execute directly inside your browser memory using HTML5 Canvas, Web Workers, and WebAssembly.

- **100% Private:** Zero server uploads. Your videos and photos never leave your device.
- **Zero Latency:** No network bottlenecks or queue waiting times.
- **Zero Server Costs:** Completely serverless client-side execution.
- **Leak-Free Memory Engine:** Strict Blob lifecycle revocation (`URL.revokeObjectURL`) to safely process large video files and hundreds of high-resolution images.

**Created by:** Kaveeth Manodhya  
**Theme:** Charcoal Neutral (`#393939`), Flame Orange (`#FF5A09`), Warm Amber (`#ec7f37`), and Burnished Rust (`#be4f0c`).

---

## Tools & Features

### 1. Advanced Video-to-Frames Extractor (`/video-extractor`)
Extract high-resolution image sequences from local video files (`.mp4`, `.webm`, `.mov`).
- **Interactive Timeline Trimmer:** Dual-handle range slider to designate precise Start and End timestamps (`[start, end]`), restricting extraction only to relevant segments.
- **Aspect Ratio Cropping:** In-memory canvas cropping presets:
  - `1:1` (Square / Social)
  - `16:9` (Widescreen HD)
  - `9:16` (Shorts / Reels / Stories)
  - `Free / Original` (Native camera dimensions)
- **Automatic ~100KB WebP Optimization:** Automatically bounds frame resolution to a maximum 1280px width and renders via lossy WebP at 75% quality for ultra-compact frame sequences.
- **Pre-Extraction Size Estimator:** Before processing starts, silently extracts a single probe frame, calculates its byte size, multiplies by the target frame count, and displays the **Estimated Total ZIP Size** (e.g. `~14.2 MB for 142 frames`).
- **Duplicate Frame Removal (aHash):** Real-time 8×8 Average Hashing algorithm analyzing `ctx.getImageData()`. Automatically detects and drops stagnant or paused frames with a Hamming distance $\le 2$.
- **Extraction Controls & Queue:** Live percentage bar, frame counter, pause/resume, individual frame preview, and one-click ZIP download (`JSZip`).

---

### 2. Sprite Sheet Maker (`/sprite-sheet`)
Pack multi-frame sequences or custom image batches into an optimized 2D texture atlas for web animations and game development.
- **Flexible Grid Controls:** Custom column counts, max cell width/height, and inter-frame cell padding (px).
- **Format Export:** Composite rendering into high-efficiency **WebP** or lossless **PNG**.
- **JSON Atlas Generator:** Exports an accompanying JSON coordinate atlas mapping each frame's exact UV and pixel positions, compatible with Phaser, PixiJS, Godot, and Unity:
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

---

### 3. Bulk Image Converter & Resizer (`/image-converter`)
Advanced client-side batch compression and format transcoding powered by `browser-image-compression`.
- **Background Web Worker Engine:** Offloads multi-pass compression iterations to background threads (`useWebWorker: true`), keeping the UI responsive even during heavy batches.
- **Target File Size Budgeting (`maxSizeMB`):** 
  - Presets: `300KB`, `500KB`, `800KB (Default)`, `1MB`, `2MB`.
  - Custom range slider and input for strict byte budgeting.
- **Smart Dimension Downscaling (`maxWidthOrHeight`):**
  - Presets: `1920 (FHD)`, `1280 (HD)`, `800 (Web)`, `Original (No limit)`.
  - Proportional downscaling prevents bloated encodes on 4K/8K images (`alwaysKeepResolution: false`).
- **Target Formats:** WebP, PNG, and JPEG.
- **Real-Time Before & After Metrics:** Live visual feedback displaying original size vs. output size, percentage savings badge (`-72% Saved`), dimension changes, and budget validation (`Target met`).
- **Export:** Download individual files or bundle the entire converted queue into a single organized ZIP archive.

---

### 4. AI Background Remover (`/bg-remover`)
Remove photo backgrounds directly inside the browser using local machine learning.
- **Offline In-Browser AI:** Powered by `@imgly/background-removal`, utilizing an ONNX neural model executed via WebAssembly.
- **Zero Cloud Leakage:** Photos never travel across the network; processing happens in local CPU/GPU memory.
- **Interactive Split Slider:** Compare original vs. cutout results side-by-side.
- **Export:** Transparent **PNG** or alpha-channel **WebP**.

---

### 5. Canvas Color Filters (`/filters`)
Direct pixel-level math transformations executed on HTML5 Canvas without CSS overlay filters.
- **Filters Included:**
  - **Grayscale:** Weighted luminance matrix ($0.299R + 0.587G + 0.114B$).
  - **Invert:** RGB bit inversion ($255 - C$).
  - **High Contrast:** S-curve pixel scaling centered around midpoint 128.
  - **Sepia:** Classic photographic toning transformation matrix.
  - **Warm Filter:** Red-channel boost with subtle blue-channel attenuation.
  - **Cool Filter:** Blue-channel boost with balanced warmth reduction.
- **Controls:** Real-time intensity slider (0% to 100%) and instant full-resolution download.

---

## Architecture & Privacy Model

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│                                                             │
│  ┌──────────────────┐   ┌─────────────────┐   ┌──────────┐  │
│  │   Video Stream   │   │  Canvas Pipeline│   │  Workers │  │
│  │   <video> HTML5  │──▶│  2D / Offscreen │──▶│ aHash/ZIP│  │
│  └──────────────────┘   └─────────────────┘   └──────────┘  │
│                                                             │
│  ┌──────────────────┐   ┌─────────────────┐   ┌──────────┐  │
│  │ Images / Photos  │──▶│ Web Worker Comp │──▶│ Download │  │
│  │ Drag & Drop      │   │ browser-img-comp│   │ / Zip    │  │
│  └──────────────────┘   └─────────────────┘   └──────────┘  │
│                                                             │
│  ┌──────────────────┐   ┌─────────────────┐                 │
│  │ Neural Cutout    │──▶│ WebAssembly     │                 │
│  │ @imgly/bg-remove │   │ ONNX Model      │                 │
│  └──────────────────┘   └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 0 Cloud Uploads
                              ▼
                [ Outside World / Internet ]
```

### Memory Safety & Lifecycle
1. **Blob Management:** Every extracted frame and converted image generates an object URL (`URL.createObjectURL(blob)`). On queue clearance, component unmount, or frame deletion, `URL.revokeObjectURL(url)` is invoked immediately to prevent memory leaks during large extractions.
2. **Worker Isolation:** Computationally intensive operations (aHash comparisons, multi-pass image re-compression, ZIP creation) run asynchronously to guarantee a smooth 60 FPS UI.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 16 (App Router)** | Framework, static route generation, and layout architecture |
| **React 19** | Component state and reactive interface |
| **Tailwind CSS 4** | Styling, responsive layout, and design system tokens |
| **browser-image-compression** | Multi-pass client-side Web Worker image compression |
| **@imgly/background-removal** | Client-side neural network background removal via WebAssembly |
| **JSZip & FileSaver** | In-browser ZIP archive compilation and automatic download |
| **Lucide React** | Clean, minimalist UI iconography |
| **Framer Motion** | Micro-interactions, transitions, and hover states |

---

## Design System

MediaTools uses a custom SaaS theme:
- **Base Surfaces:** `#141414` (Primary background), `#1f1f1f` (Card surface), `#2a2a2a` (Elevated)
- **Charcoal Neutral:** `#393939` (Borders and dividers)
- **Flame Orange (Primary):** `#FF5A09` (Call-to-actions, active buttons, logos)
- **Warm Amber (Secondary):** `#ec7f37` (Hover states, gradient highlights)
- **Burnished Rust (Dark Accent):** `#be4f0c` (Active sliders, badges)
- **Typography:** `Inter` (UI elements) and `JetBrains Mono` (Technical metrics and file sizes)

---

## Project Structure

```
├── public/
│   ├── logo.png                   # High-res 2000x2000 crisp brand logo
│   ├── favicon.ico                # Root favicon
│   ├── favicon-32x32.png          # 32px favicon
│   ├── favicon-16x16.png          # 16px favicon
│   ├── apple-touch-icon.png       # Apple touch icon
│   ├── android-chrome-192x192.png # PWA 192px icon
│   ├── android-chrome-512x512.png # PWA 512px icon
│   └── site.webmanifest           # App manifest
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, metadata, and font definitions
│   │   ├── page.tsx               # Homepage and media tools landing hub
│   │   ├── globals.css            # Global CSS variables, theme tokens, and components
│   │   ├── video-extractor/       # /video-extractor route
│   │   ├── sprite-sheet/          # /sprite-sheet route
│   │   ├── image-converter/       # /image-converter route
│   │   ├── bg-remover/            # /bg-remover route
│   │   └── filters/               # /filters route
│   ├── components/
│   │   ├── Navbar.tsx             # Header navigation bar with custom logo
│   │   ├── Footer.tsx             # Footer with author credits and tool links
│   │   ├── AdvancedVideoExtractor.tsx # Full video extractor implementation
│   │   ├── SpritesheetMaker.tsx   # Sprite sheet assembly and JSON atlas export
│   │   ├── BulkImageConverter.tsx # Advanced browser-image-compression engine
│   │   ├── BgRemover.tsx          # Local AI background removal
│   │   └── CanvasColorFilters.tsx # Pixel math color filter playground
│   ├── hooks/
│   │   ├── useVideoExtractor.ts   # Video extraction loop, aHash, and memory management
│   │   └── useBulkConverter.ts    # Batch compression hook
│   └── lib/
│       ├── videoUtils.ts          # aHash calculation, Hamming distance, frame sampling
│       ├── utils.ts               # File size formatters, class merges
│       └── zipUtils.ts            # JSZip packaging and frame archiving
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18.17+ or 20+
- npm or pnpm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd "vid to frames"

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
npm run start
```

---

## License & Credits

- **Author & Creator:** Kaveeth Manodhya
- Built as a private, high-performance media suite. All transformations are performed strictly on the client device.
