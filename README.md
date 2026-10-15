# MediaTools

<p align="center">
  <a href="https://mediatoolslk.vercel.app/">
    <img src="public/logo.png" alt="MediaTools logo" width="110" />
  </a>
</p>

<p align="center">
  <strong>11 free, privacy-focused tools for images, video, and animation.</strong><br />
  Process media directly in your browser with a modern Next.js interface.
</p>

<p align="center">
  <a href="https://mediatoolslk.vercel.app/"><img src="https://img.shields.io/badge/Live%20Website-MediaTools-FF5A09?style=for-the-badge" alt="Open MediaTools" /></a>
  <img src="https://img.shields.io/badge/Tools-11-393939?style=for-the-badge" alt="11 media tools" />
  <img src="https://img.shields.io/badge/Project%20Version-0.1.0-FF5A09?style=for-the-badge" alt="Project version 0.1.0" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs" alt="Next.js 16" />
</p>

<p align="center">
  <a href="https://mediatoolslk.vercel.app/"><strong>Try MediaTools</strong></a> ·
  <a href="#whats-new--version-history">What's New</a> ·
  <a href="#tools--features">Tools & Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#getting-started">Run Locally</a> ·
  <a href="#contributing--feedback">Contribute</a>
</p>

---

## Overview

**MediaTools** is a collection of browser-based media utilities built with **Next.js, React, TypeScript, Tailwind CSS, Canvas, and WebAssembly**. It includes image conversion and compression, cropping, watermarking, PDF creation, metadata cleaning, GIF animation, sprite sheet generation, video frame extraction, AI-assisted background removal, and image filtering.

- **Local file processing:** The media editing workflows run on your device rather than uploading your source images or videos to an application server.
- **Easy exporting:** Save processed files individually or as ZIP archives in tools that support batch output.
- **Responsive UI:** A dark charcoal/orange interface with grouped desktop navigation and mobile access.
- **No account needed:** Open a tool, choose your file, edit, and download.
- **AI background removal:** The browser can download required model resources for the AI tool on initial use. Processing of your selected media happens locally.

**Creator:** Kaveeth Manodhya  
**Live website:** https://mediatoolslk.vercel.app/  
**Source version:** 0.1.0 (as declared in `package.json`)

> **Versioning note:** The package currently reports version **0.1.0**. The dated entries below describe changes merged into the repository, not separately tagged semantic-version releases. Update `package.json` and create a GitHub release when you want to publish the next official version.

---

## What's New & Version History

| Date | Milestone | Highlights | Status |
| --- | --- | --- | --- |
| **2026-10-15** | Expanded media toolkit | Added **Image Crop & Resize**, **Image Watermark**, **Image to PDF**, **Metadata Cleaner**, **GIF Maker**, and **Image Upscaler** | On `main` |
| **2026-10-15** | Interface and navigation refresh | Added grouped navigation for image, video/animation, and AI/editing tools; updated the landing page for the 11-tool suite | On `main` |
| **Initial project** | Core media toolkit | Video-to-Frames Extractor, Sprite Sheet Maker, Bulk Image Converter, AI Background Remover, and Color Filters | On `main` |

### Under review / next improvements

Further responsive control alignment, closing previously opened navigation dropdowns automatically, and Vercel Web Analytics integration are being reviewed in [PR #4](https://github.com/kaveethmanodhya/Media-Tools/pull/4). **These are not listed as completed releases.**

### Feature availability

The table below lists tools present in the repository's `main` branch. Deployment timing may differ from the latest source code.

## Tools & Features

| Tool | Route | What it does |
| --- | --- | --- |
| 🎞️ Video-to-Frames Extractor | [`/video-extractor`](https://mediatoolslk.vercel.app/video-extractor) | Export frames from video with trimming, crop ratios, duplicate filtering, and ZIP downloads |
| 🧩 Sprite Sheet Maker | [`/sprite-sheet`](https://mediatoolslk.vercel.app/sprite-sheet) | Pack images into a sprite atlas and export coordinate metadata |
| 🖼️ Bulk Image Converter | [`/image-converter`](https://mediatoolslk.vercel.app/image-converter) | Convert, compress, resize, and batch-export images |
| ✨ AI Background Remover | [`/bg-remover`](https://mediatoolslk.vercel.app/bg-remover) | Remove image backgrounds locally using an AI model |
| 🎨 Color Filters | [`/filters`](https://mediatoolslk.vercel.app/filters) | Apply grayscale, sepia, contrast, invert, warm, and cool effects |
| ✂️ Crop & Resize | [`/crop-resize`](https://mediatoolslk.vercel.app/crop-resize) | Crop to common ratios and export at a chosen width |
| 🏷️ Image Watermark | [`/watermark`](https://mediatoolslk.vercel.app/watermark) | Add text or logo watermarks to multiple images |
| 📄 Image to PDF | [`/image-to-pdf`](https://mediatoolslk.vercel.app/image-to-pdf) | Combine images into a multi-page PDF |
| 🔒 Metadata Cleaner | [`/metadata-cleaner`](https://mediatoolslk.vercel.app/metadata-cleaner) | Re-encode images without copying original EXIF/GPS metadata |
| 🎬 GIF Maker | [`/gif-maker`](https://mediatoolslk.vercel.app/gif-maker) | Make looping GIFs from still images |
| 🔍 Image Upscaler | [`/upscaler`](https://mediatoolslk.vercel.app/upscaler) | Enlarge images 2×, 3×, or 4× using canvas interpolation |

### Original Tools (Core Toolkit)

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

### 6. Image Crop & Resize (`/crop-resize`)
- Crop by position and size with live selection preview.
- Choose common ratios such as **1:1**, **4:3**, **16:9**, and **9:16**, or keep a free crop.
- Resize the selected region using a custom output width; export to **PNG, JPEG, or WebP**.
- Includes output-size guardrails to reduce browser memory problems.

### 7. Image Watermark (`/watermark`)
- Add **text**, **logo**, or both to images.
- Set watermark placement (corners or center), opacity, and scale.
- Process image batches and download a **ZIP** for multiple results.
- Export to PNG, JPEG, or WebP.

### 8. Image to PDF (`/image-to-pdf`)
- Combine multiple photos into an ordered, multi-page PDF.
- Choose **A4**, **US Letter**, or **Fit to image** page sizing.
- Adjust page margins and remove unwanted files from the selected list.
- Generate the PDF locally without sending source images to a backend.

### 9. Image Metadata Cleaner (`/metadata-cleaner`)
- Remove original EXIF, GPS, and camera metadata by decoding and re-encoding image pixels to a fresh canvas.
- Supports batch output and ZIP downloads.
- Select **PNG**, **JPEG**, or **WebP** as the new image format.
- **Important:** Re-encoding can change image size, colors, and compression. It is intended for common metadata removal, not a forensic privacy guarantee.

### 10. GIF Maker (`/gif-maker`)
- Turn **2–40 still images** into a looping animated GIF.
- Set frame delay and output width, up to a **512 px** dimension limit.
- Uses a browser-side, **256-color GIF encoder**.
- The limited palette may reduce fidelity for gradients and complex photos.

### 11. Image Upscaler (`/upscaler`)
- Enlarge images by **2×**, **3×**, or **4×**.
- Uses multi-pass, high-quality **Canvas interpolation** with export to PNG, JPEG, or WebP.
- **Not AI super-resolution:** It scales existing pixels smoothly but does not reconstruct lost photographic detail.

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

### Local Processing & Memory Management

MediaTools relies on browser APIs such as HTML5 Canvas, object URLs, and WebAssembly. Output files are assembled in browser memory; some batch workflows use JSZip or browser workers.

- Image and video files selected in the tools are processed locally instead of being uploaded to the app's backend.
- AI model code/assets may need to load from external sources before the first background-removal session.
- Browser memory and performance depend on device capabilities, file sizes, and supported codecs.
- The app's source code uses `URL.createObjectURL` / `URL.revokeObjectURL` in relevant media workflows to help manage temporary previews.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 16 (App Router)** | Routing, metadata, and page architecture |
| **TypeScript** | Typed React components and media utilities |
| **React 19** | Component state and reactive interface |
| **Tailwind CSS 4** | Styling, responsive layout, and design system tokens |
| **browser-image-compression** | Multi-pass client-side Web Worker image compression |
| **@imgly/background-removal** | Client-side neural network background removal via WebAssembly |
| **JSZip & FileSaver** | In-browser ZIP archive compilation and downloads |
| **Custom Canvas/PDF/GIF utilities** | Cropping, watermarking, re-encoding, image PDFs, and animated GIF export |
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
│   │   ├── filters/               # /filters route
│   │   ├── crop-resize/           # /crop-resize route
│   │   ├── watermark/             # /watermark route
│   │   ├── image-to-pdf/          # /image-to-pdf route
│   │   ├── metadata-cleaner/      # /metadata-cleaner route
│   │   ├── gif-maker/             # /gif-maker route
│   │   └── upscaler/              # /upscaler route
│   ├── components/
│   │   ├── Navbar.tsx             # Header navigation bar with custom logo
│   │   ├── Footer.tsx             # Footer with author credits and tool links
│   │   ├── AdvancedVideoExtractor.tsx # Full video extractor implementation
│   │   ├── SpritesheetMaker.tsx   # Sprite sheet assembly and JSON atlas export
│   │   ├── BulkImageConverter.tsx # Advanced browser-image-compression engine
│   │   ├── BgRemover.tsx          # Local AI background removal
│   │   ├── CanvasColorFilters.tsx # Pixel math color filter playground
│   │   ├── CanvasTools.tsx        # Crop, resize, and upscaler UI
│   │   ├── ImageWatermarkTool.tsx # Batch watermarking tool
│   │   └── DocumentAnimationTools.tsx # Image PDF, metadata cleaning, GIF maker
│   ├── hooks/
│   │   ├── useVideoExtractor.ts   # Video extraction loop, aHash, and memory management
│   │   └── useBulkConverter.ts    # Batch compression hook
│   └── lib/
│       ├── videoUtils.ts          # aHash calculation, Hamming distance, frame sampling
│       ├── utils.ts               # File size formatters, class merges
│       ├── zipUtils.ts            # JSZip packaging and frame archiving
│       └── additionalMedia.ts     # Canvas, PDF, GIF, and download helpers
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js **20.9+** (Next.js 16 requirement)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/kaveethmanodhya/Media-Tools.git
cd Media-Tools

# Install dependencies
npm ci

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

## Contributing & Feedback

Found a bug, a layout issue, or have an idea for a new tool?

1. Open an [issue](https://github.com/kaveethmanodhya/Media-Tools/issues) describing the problem or feature.
2. For code changes, create a branch and open a pull request.
3. Include screenshots or steps to reproduce for UI issues.

If MediaTools is useful to you, please **⭐ star the repository** to support the project.

## License & Credits

**Developed by Kaveeth Manodhya.**

No software license file is currently provided in the repository. Please contact the maintainer before assuming redistribution rights.

**Live app:** https://mediatoolslk.vercel.app/

