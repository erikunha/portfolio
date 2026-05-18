// components/sections/Hero.tsx
// RSC — no 'use client'. Static markup only. Client islands handle animations.
// Both variants are server-rendered; CSS media query hides the non-matching one.
// Spec: docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §6.

import { HeroBootAnimation } from '../client/HeroBootAnimation';
import { HeroSystemFailure } from '../client/HeroSystemFailure';

export function Hero() {
  return (
    <>
      {/* Desktop: two-column layout — boot animation left, bio panel right.
          id="bio" is the anchor target used by DesktopTopbar nav links.
          Hidden on mobile via .hero--desktop CSS rule (max-width: 768px). */}
      <section id="bio" className="hero hero--desktop">
        <div className="hero__left">
          <HeroBootAnimation variant="desktop" />
        </div>
        <aside className="hero__bio">
          <h1 className="hero__name">Erik Henrique Alves Cunha</h1>
          <p className="hero__tagline">
            Senior Full-Stack Engineer, Frontend · 8+ yrs in building systems to support business
            operations · fintech (PCI-DSS), healthcare, global e-commerce
          </p>
          <p className="hero__meta">
            <span>
              LOC: <b>Brazil</b>
            </span>
            <span>
              NOW: <b>Betsson</b>
            </span>
            <span>EN/PT/FR/ES</span>
          </p>
          <p className="hero__status">
            <span className="hero__status-dot" aria-hidden="true" />
            OPEN_TO_RELOCATION · WORLDWIDE
          </p>
          <div className="hero__ctas">
            <a
              className="hero__cta hero__cta--primary"
              href="https://www.linkedin.com/in/erikunha/"
              target="_blank"
              rel="noreferrer"
            >
              EXEC HIRE
            </a>
            <a
              className="hero__cta hero__cta--secondary"
              href="https://github.com/erikunha"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB ↗
            </a>
          </div>
        </aside>
        {/* Sysfail overlay — mounted once, desktop-only (event-driven show/hide). */}
        <HeroSystemFailure />
      </section>

      {/* Mobile: stacked layout — boot animation on top, bio below.
          Hidden on desktop via .hero--mobile CSS rule (min-width: 769px).
          No id needed here — anchor target #bio is on the desktop section. */}
      <section className="hero hero--mobile">
        <div className="hero__inner">
          <HeroBootAnimation variant="mobile" />

          <h1 className="hero__name">Erik Henrique Alves Cunha</h1>
          <p className="hero__tagline">
            Senior Full-Stack Engineer, Frontend · 8+ yrs in building systems to support business
            operations · fintech (PCI-DSS), healthcare, global e-commerce
          </p>
          <p className="hero__meta">
            <span>
              LOC: <b>Brazil</b>
            </span>
            <span>
              NOW: <b>Betsson</b>
            </span>
            <span>EN/PT/FR/ES</span>
          </p>
          <p className="hero__status">
            <span className="hero__status-dot" aria-hidden="true" />
            OPEN_TO_RELOCATION · WORLDWIDE
          </p>
          <div className="hero__ctas">
            <a
              className="hero__cta hero__cta--primary"
              href="https://www.linkedin.com/in/erikunha/"
              target="_blank"
              rel="noreferrer"
            >
              EXEC HIRE
            </a>
            <a
              className="hero__cta hero__cta--secondary"
              href="https://github.com/erikunha"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
