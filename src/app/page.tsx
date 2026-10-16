import type { Metadata } from "next";
import Link from "next/link";
import {
  Film,
  Layers,
  ImageIcon,
  Eraser,
  Sliders,
  Zap,
  Shield,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Crop,
  Stamp,
  FileImage,
  ShieldCheck,
  Clapperboard,
  Maximize2,
  EyeOff,
  Scissors,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Home",
  description:
    "MediaTools is a client-side media suite. Extract video frames, pack sprite sheets, batch convert images, remove backgrounds with local AI, upscale with super-resolution, blur/censor sensitive areas, and slice images into parts — completely in your browser.",
};

const tools = [
  { href: "/upscaler", title: "AI Image Upscaler", icon: Maximize2, desc: "Enhance and upscale photos with edge-directed super-resolution, unsharp clarity masking, and micro-contrast boost.", badge: "Super-Res", features: ["2× to 4× scaling", "Adaptive edge sharpening", "Split comparison view"] },
  { href: "/blur", title: "Image Blur & Censor", icon: EyeOff, desc: "Blur full photos or censor sensitive faces, license plates, and confidential text with draggable Gaussian or mosaic masks.", badge: "Privacy", features: ["Draggable censor boxes", "Pixelate mosaic & Gaussian", "Bokeh portrait mode"] },
  { href: "/image-splitter", title: "Image Splitter & Cutter", icon: Scissors, desc: "Slice photos into grid tiles, Instagram 3×3 feeds, or seamless swipe panorama carousels with single-click ZIP export.", badge: "New", features: ["Instagram 3×3 & carousels", "Visual cutting guide", "Download all as ZIP"] },
  { href: "/crop-resize", title: "Image Crop & Resize", icon: Crop, desc: "Crop and resize photos precisely with standard aspect ratios, custom dimensions, and local exports.", badge: null, features: ["Crop presets", "Flexible output sizes", "PNG / JPEG / WebP"] },
  { href: "/watermark", title: "Image Watermark", icon: Stamp, desc: "Protect image batches using custom text or a logo with adjustable position and opacity.", badge: null, features: ["Batch watermarking", "Text and image marks", "ZIP output"] },
  { href: "/image-to-pdf", title: "Image to PDF", icon: FileImage, desc: "Create a multi-page PDF from images entirely within your browser.", badge: null, features: ["A4 / Letter / Fit", "Multi-image PDFs", "No uploads"] },
  { href: "/metadata-cleaner", title: "Metadata Cleaner", icon: ShieldCheck, desc: "Re-encode photos to strip original EXIF, camera data and GPS metadata.", badge: null, features: ["Privacy focused", "Batch processing", "Re-encode locally"] },
  { href: "/gif-maker", title: "GIF Maker", icon: Clapperboard, desc: "Build an animated GIF from a sequence of still images, with frame delay and size controls.", badge: null, features: ["Looping animations", "Timing controls", "Local GIF encoder"] },

  {
    href: "/video-extractor",
    title: "Video → Frames Extractor",
    icon: Film,
    desc: "Extract WebP frames with interactive dual-handle timeline trimming, crop presets, perceptual duplicate removal (aHash), and ZIP export.",
    badge: "Most Popular",
    features: ["Dual-handle trimmer", "aHash duplicate filter", "ZIP archive export"],
  },
  {
    href: "/sprite-sheet",
    title: "Sprite Sheet Maker",
    icon: Layers,
    desc: "Pack sequences of frames into optimized 2D grid sheets and generate accompanying JSON coordinate maps for game engines and animations.",
    badge: null,
    features: ["Custom column packing", "JSON UV coordinates", "WebP & PNG export"],
  },
  {
    href: "/image-converter",
    title: "Bulk Image Converter",
    icon: ImageIcon,
    desc: "Batch convert and downscale dozens of PNG, JPEG, and WebP images simultaneously with live before/after compression stats.",
    badge: null,
    features: ["Batch drag-and-drop", "Live savings meter", "Quality & dimension control"],
  },
  {
    href: "/bg-remover",
    title: "AI Background Remover",
    icon: Eraser,
    desc: "Extract subjects and remove backgrounds completely offline using an in-browser neural network running locally via WebAssembly.",
    badge: "Local AI",
    features: ["100% offline model", "Zero cloud telemetry", "Transparent PNG/WebP"],
  },
  {
    href: "/filters",
    title: "Canvas Color Filters",
    icon: Sliders,
    desc: "Apply mathematical pixel transformations directly via HTML5 Canvas ImageData — Invert, Grayscale, High Contrast, Sepia, and color temperature.",
    badge: null,
    features: ["Pure pixel math", "Adjustable intensity", "Full-resolution download"],
  },
];

const pillars = [
  {
    icon: Shield,
    title: "100% Private & Local",
    desc: "Your files are never transmitted to any cloud or backend server. All decoding and transformation run in local memory.",
  },
  {
    icon: Cpu,
    title: "Hardware Accelerated",
    desc: "Taps directly into HTML5 Canvas, Web Workers, and WebAssembly to process gigabyte video files smoothly.",
  },
  {
    icon: Zap,
    title: "Zero Rate Limits",
    desc: "No registrations, no subscriptions, and no quotas. Process unlimited files as fast as your CPU and GPU can render.",
  },
  {
    icon: Lock,
    title: "Leak-Free Memory Engine",
    desc: "Engineered with strict Blob lifecycle revocation to protect system memory during thousand-frame bulk extractions.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Select or Drop Media",
    desc: "Drop your video or images directly onto any tool. Files load instantly into browser memory with zero network delay.",
  },
  {
    step: "02",
    title: "Configure & Process",
    desc: "Fine-tune timeline ranges, quality sliders, crop ratios, or filters. Watch live real-time preview canvas feeds.",
  },
  {
    step: "03",
    title: "Download Output",
    desc: "Download single optimized images or package everything into a single organized ZIP bundle with a single click.",
  },
];

export default function HomePage() {
  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} className="hero-badge-icon" />
          <span>Client-Side Media Processing Suite</span>
        </div>
        <h1 className="hero-title">
          Process Media at Warp Speed.
          <br />
          <span className="hero-title-accent">Zero Server Uploads.</span>
        </h1>
        <p className="hero-subtitle">
          Extract high-res frames, generate sprite sheets, convert image formats in bulk, remove backgrounds with offline AI, and apply pixel filters — entirely inside your web browser.
        </p>

        <div className="hero-actions">
          <Link href="/video-extractor" className="btn btn-primary btn-lg">
            <span>Launch Video Extractor</span>
            <ArrowRight size={17} />
          </Link>
          <a href="#tools" className="btn btn-secondary btn-lg">
            Browse All Tools
          </a>
        </div>

        {/* Quick Stats Banner */}
        <div className="hero-stats-strip">
          <div className="stat-pill">
            <span className="stat-num">11</span>
            <span className="stat-label-text">Pro Tools</span>
          </div>
          <div className="stat-pill-divider" />
          <div className="stat-pill">
            <span className="stat-num">0B</span>
            <span className="stat-label-text">Server Uploads</span>
          </div>
          <div className="stat-pill-divider" />
          <div className="stat-pill">
            <span className="stat-num">100%</span>
            <span className="stat-label-text">Private & Local</span>
          </div>
          <div className="stat-pill-divider" />
          <div className="stat-pill">
            <span className="stat-num">Free</span>
            <span className="stat-label-text">No Limits</span>
          </div>
        </div>
      </section>

      {/* Tools Catalog */}
      <section id="tools" className="tools-catalog-section">
        <div className="section-header">
          <div className="section-tag">Toolkit</div>
          <h2 className="section-title">Standalone Browser Utilities</h2>
          <p className="section-subtitle">
            Engineered from scratch using modern web APIs. Click any tool to get started immediately.
          </p>
        </div>

        <div className="tools-grid-website">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} className="website-tool-card">
                <div className="card-top-row">
                  <div className="tool-card-icon-box">
                    <Icon size={22} strokeWidth={2} />
                  </div>
                  {t.badge && (
                    <span className="badge badge-mint">{t.badge}</span>
                  )}
                </div>

                <h3 className="website-tool-title">{t.title}</h3>
                <p className="website-tool-desc">{t.desc}</p>

                <ul className="tool-feature-list">
                  {t.features.map((feat) => (
                    <li key={feat} className="tool-feature-item">
                      <CheckCircle2 size={13} className="feature-check-icon" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="card-action-link">
                  <span>Open Tool</span>
                  <ArrowRight size={14} className="action-arrow" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="workflow-section">
        <div className="section-header">
          <div className="section-tag">Architecture</div>
          <h2 className="section-title">How In-Browser Processing Works</h2>
          <p className="section-subtitle">
            Say goodbye to waiting in queues or uploading sensitive client media to third-party servers.
          </p>
        </div>

        <div className="workflow-grid">
          {workflowSteps.map((step) => (
            <div key={step.step} className="workflow-card">
              <span className="workflow-step-num">{step.step}</span>
              <h3 className="workflow-step-title">{step.title}</h3>
              <p className="workflow-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Advantages */}
      <section className="pillars-section">
        <div className="section-header">
          <div className="section-tag">Performance</div>
          <h2 className="section-title">Engineered for Reliability</h2>
          <p className="section-subtitle">
            Built for developers, video editors, and game creators who require speed and autonomy.
          </p>
        </div>

        <div className="pillars-grid">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="pillar-card">
                <div className="pillar-icon-box">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className="pillar-title">{p.title}</h3>
                <p className="pillar-desc">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="cta-banner-section">
        <div className="cta-banner-card">
          <div className="cta-content">
            <h2 className="cta-title">Ready to extract or convert?</h2>
            <p className="cta-subtitle">
              Jump straight into the Video Extractor or batch image converter with zero setup.
            </p>
          </div>
          <div className="cta-actions">
            <Link href="/video-extractor" className="btn btn-primary btn-lg">
              Launch Tools Now
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
