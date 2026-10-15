'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Layers, ImageIcon, Eraser, Sliders, Home, Menu, X, ShieldCheck } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/video-extractor', label: 'Video Extractor', icon: Film, badge: 'HD' },
  { href: '/sprite-sheet', label: 'Sprite Sheet', icon: Layers },
  { href: '/image-converter', label: 'Image Converter', icon: ImageIcon },
  { href: '/bg-remover', label: 'BG Remover', icon: Eraser, badge: 'AI' },
  { href: '/filters', label: 'Color Filters', icon: Sliders },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="site-navbar" onKeyDown={(event) => { if (event.key === "Escape") setMobileMenuOpen(false); }}>
      <div className="navbar-container">
        {/* Brand Logo */}
        <Link href="/" className="navbar-logo" onClick={() => setMobileMenuOpen(false)}>
          <img
            src="/logo.png"
            alt="MediaTools Logo"
            width={32}
            height={32}
            className="navbar-logo-img"
          />
          <div className="navbar-logo-text">
            <span>Media<span className="logo-accent">Tools</span></span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navbar-link${isActive ? ' active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={15} strokeWidth={1.8} className="navbar-link-icon" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="navbar-link-badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA / Badge */}
        <div className="navbar-actions">
          <div className="privacy-pill">
            <ShieldCheck size={14} className="privacy-pill-icon" />
            <span>100% In-Browser</span>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <nav id="mobile-navigation" className="mobile-nav-drawer" aria-label="Mobile navigation">
          <div className="mobile-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="navbar-link-badge" style={{ marginLeft: 'auto' }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
