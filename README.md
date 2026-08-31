# Video-to-Frames-Generator

A high-performance web application built with [Next.js](https://nextjs.org) and TailwindCSS that provides two powerful client-side media processing tools in a sleek, modern tabbed interface.

## 🚀 Features

The application is divided into two main sections:

### 1. Video to Frames Extractor
- Upload a video file and effortlessly extract individual frames.
- Perfect for analyzing video content, creating thumbnails, or converting video segments into image sequences.
- Operates entirely client-side for maximum privacy and performance.

### 2. Bulk WebP Converter
- Batch process multiple images (such as JPEGs or PNGs) and convert them into the highly-optimized WebP format.
- Ensure clear structural separation for image processing workflows.
- Reduces file sizes significantly while maintaining high visual quality.
- Uses bulk-download capabilities (via ZIP) to save processed files with ease.

## 🛠️ Tech Stack

- **Framework**: React 19 / Next.js
- **Styling**: TailwindCSS (v4), `clsx`, `tailwind-merge`
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Utilities**: `jszip` and `file-saver` for packaging and downloading processed media.

## 💻 Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app in action.

## ⚙️ How it Works

This application leverages modern browser capabilities to handle file processing directly on the client side. This means that:
- **No data is sent to a server:** Your videos and images never leave your computer.
- **Fast execution:** Taking advantage of local hardware makes processing incredibly quick. 
- **Tabbed Interface:** State is managed carefully in `src/app/page.tsx` to seamlessly toggle between the video-processing and image-converting components (`<VideoExtractor />` and `<BulkConverter />`) without reloading the page.
