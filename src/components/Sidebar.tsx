'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Layers, ImageIcon, Eraser, Sliders, Home, Zap, EyeOff, Scissors, Maximize2 } from 'lucide-react';

const tools = [
  {
    href: '/',
    label: 'Dashboard',
    icon: Home,
    badge: null,
  },
  {
    href: '/upscaler',
    label: 'AI Upscaler',
    icon: Maximize2,
    badge: 'AI',
  },
  {
    href: '/blur',
    label: 'Image Blur & Censor',
    icon: EyeOff,
    badge: null,
  },
  {
    href: '/image-splitter',
    label: 'Image Splitter',
    icon: Scissors,
    badge: null,
  },
  {
    href: '/video-extractor',
    label: 'Video → Frames',
    icon: Film,
    badge: 'New',
  },
  {
    href: '/sprite-sheet',
    label: 'Sprite Sheet Maker',
    icon: Layers,
    badge: null,
  },
  {
    href: '/image-converter',
    label: 'Bulk Converter',
    icon: ImageIcon,
    badge: null,
  },
  {
    href: '/bg-remover',
    label: 'BG Remover (AI)',
    icon: Eraser,
    badge: 'AI',
  },
  {
    href: '/filters',
    label: 'Color Filters',
    icon: Sliders,
    badge: null,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <Link href="/" className="sidebar-logo-title" style={{ textDecoration: 'none' }}>
          <img
            src="/logo.png"
            alt="MediaTools Logo"
            width={28}
            height={28}
            style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
          <span>Media<span className="logo-accent">Tools</span></span>
        </Link>
        <p className="sidebar-logo-subtitle">Private Client-Side Suite</p>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav" role="list">
        <div className="sidebar-section-label">Tools</div>

        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = pathname === tool.href;

          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              role="listitem"
            >
              <span className="nav-item-icon" aria-hidden="true">
                <Icon size={17} strokeWidth={1.8} />
              </span>
              <span>{tool.label}</span>
              {tool.badge && (
                <span className="nav-badge">{tool.badge}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        100% In-Browser · No Uploads
      </div>
    </nav>
  );
}
