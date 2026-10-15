import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Cpu, Zap, Heart } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-container">
        {/* Main Footer Grid */}
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-col brand-col">
            <Link href="/" className="footer-logo">
              <img
                src="/logo.png"
                alt="MediaTools Logo"
                width={32}
                height={32}
                className="footer-logo-img"
              />
              <span className="footer-brand-title">
                Media<span className="logo-accent">Tools</span>
              </span>
            </Link>
            <p className="footer-desc">
              High-performance, privacy-first media utilities running entirely inside your browser using HTML5 Canvas, WebAssembly, and local workers. Zero cloud uploads.
            </p>
            <div className="footer-features-pills">
              <span className="footer-pill"><ShieldCheck size={13} /> 100% Client-Side</span>
              <span className="footer-pill"><Cpu size={13} /> Hardware Accelerated</span>
              <span className="footer-pill"><Zap size={13} /> Zero Uploads</span>
            </div>
          </div>

          {/* Quick Links / Tools */}
          <div className="footer-col">
            <h3 className="footer-heading">Tools</h3>
            <ul className="footer-links">
              <li><Link href="/video-extractor">Video to Frames</Link></li>
              <li><Link href="/sprite-sheet">Sprite Sheet Maker</Link></li>
              <li><Link href="/image-converter">Bulk Image Converter</Link></li>
              <li><Link href="/bg-remover">AI Background Remover</Link></li>
              <li><Link href="/filters">Canvas Color Filters</Link></li>
            </ul>
          </div>

          {/* Technical Specs */}
          <div className="footer-col">
            <h3 className="footer-heading">Capabilities</h3>
            <ul className="footer-links">
              <li><span>Timeline Trimming & Crop</span></li>
              <li><span>Duplicate aHash Elimination</span></li>
              <li><span>WebP / PNG / JPEG Export</span></li>
              <li><span>ONNX Neural Cutouts</span></li>
              <li><span>Zip Archive Bundling</span></li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="footer-divider" />

        {/* Bottom Credits & Copyright */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} MediaTools. All media processing occurs on your local device.
          </p>
          <div className="footer-creator">
            <span>Created by</span>
            <span className="creator-badge">
              Kaveeth Manodhya
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
