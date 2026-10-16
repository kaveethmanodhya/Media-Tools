'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Film, Layers, ImageIcon, Eraser, SlidersHorizontal, Home,
  Menu, X, ShieldCheck, Crop, Stamp, FileImage, Clapperboard,
  Maximize2, ChevronDown, Sparkles, LockKeyhole, EyeOff, Scissors
} from 'lucide-react';

const sections = [
  {
    title: 'Image tools',
    icon: ImageIcon,
    items: [
      { href: '/image-converter', label: 'Bulk Image Converter', icon: ImageIcon },
      { href: '/crop-resize', label: 'Crop & Resize', icon: Crop },
      { href: '/blur', label: 'Image Blur & Censor', icon: EyeOff },
      { href: '/image-splitter', label: 'Image Splitter & Cutter', icon: Scissors },
      { href: '/watermark', label: 'Image Watermark', icon: Stamp },
      { href: '/image-to-pdf', label: 'Image to PDF', icon: FileImage },
      { href: '/metadata-cleaner', label: 'Metadata Cleaner', icon: LockKeyhole },
      { href: '/upscaler', label: 'AI Image Upscaler', icon: Maximize2 },
    ],
  },
  {
    title: 'Video & animation',
    icon: Film,
    items: [
      { href: '/video-extractor', label: 'Video to Frames', icon: Film },
      { href: '/sprite-sheet', label: 'Sprite Sheet Maker', icon: Layers },
      { href: '/gif-maker', label: 'GIF Maker', icon: Clapperboard },
    ],
  },
  {
    title: 'AI & editing',
    icon: Sparkles,
    items: [
      { href: '/bg-remover', label: 'AI Background Remover', icon: Eraser },
      { href: '/filters', label: 'Color Filters', icon: SlidersHorizontal },
    ],
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-navbar mt-navbar" onKeyDown={event => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.querySelectorAll<HTMLDetailsElement>('.mt-nav-dropdown[open]')
          .forEach(detail => { detail.open = false; });
      }
    }}>
      <div className="navbar-container mt-navbar-inner">
        <Link href="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <img
            src="/logo.png" alt="" width={36} height={36}
            className="navbar-logo-img"
          />
          <span className="navbar-logo-text">
            Media<span className="logo-accent">Tools</span>
          </span>
        </Link>

        <nav className="mt-desktop-nav" aria-label="Main navigation">
          <Link href="/" className={'mt-nav-home' + (pathname === '/' ? ' active' : '')}
            aria-current={pathname === '/' ? 'page' : undefined}>
            <Home size={16}/> Home
          </Link>
          {sections.map(section => {
            const SectionIcon = section.icon;
            const active = section.items.some(item => item.href === pathname);
            return <details className="mt-nav-dropdown" key={section.title}>
              <summary
                className={'mt-nav-trigger' + (active ? ' active' : '')}
                onClick={event => {
                  const currentDropdown = event.currentTarget.closest('details');
                  event.currentTarget.closest('nav')
                    ?.querySelectorAll<HTMLDetailsElement>('.mt-nav-dropdown[open]')
                    .forEach(dropdown => {
                      if (dropdown !== currentDropdown) dropdown.open = false;
                    });
                }}
              >
                <SectionIcon size={16}/>
                {section.title}
                <ChevronDown size={13} className="mt-nav-chevron"/>
              </summary>
              <div className="mt-nav-panel">
                <div className="mt-nav-panel-heading">{section.title}</div>
                {section.items.map(item => {
                  const Icon = item.icon;
                  return <Link key={item.href} href={item.href}
                    className={'mt-nav-panel-item' + (pathname === item.href ? ' active' : '')}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    onClick={event => {
                      const parent = event.currentTarget.closest('details');
                      if (parent) parent.open = false;
                    }}>
                    <Icon size={17}/>
                    <span>{item.label}</span>
                  </Link>;
                })}
              </div>
            </details>;
          })}
        </nav>

        <div className="mt-navbar-right">
          <span className="privacy-pill mt-privacy-pill">
            <ShieldCheck size={14}/>
            Private & local
          </span>
          <button type="button" className="mt-menu-button" onClick={() => setMenuOpen(v => !v)}
            aria-expanded={menuOpen} aria-controls="mt-mobile-navigation"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>
      {menuOpen && <nav id="mt-mobile-navigation" className="mt-mobile-nav" aria-label="Mobile navigation">
        <div className="mt-mobile-nav-inner">
          <Link href="/" className={'mt-mobile-link' + (pathname === '/' ? ' active' : '')}
            onClick={() => setMenuOpen(false)}>
            <Home size={17}/> Home
          </Link>
          {sections.map(section => <section key={section.title} className="mt-mobile-section">
            <h2>{section.title}</h2>
            <div className="mt-mobile-items">
              {section.items.map(item => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href}
                  className={'mt-mobile-link' + (pathname === item.href ? ' active' : '')}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}>
                  <Icon size={17}/>{item.label}
                </Link>;
              })}
            </div>
          </section>)}
        </div>
      </nav>}
    </header>
  );
}
