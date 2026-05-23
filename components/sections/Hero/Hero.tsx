// components/sections/Hero.tsx
// RSC — no 'use client'. Static markup only. Client islands handle animations.
// Both variants are server-rendered; CSS media query hides the non-matching one.
// Spec: docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §6.

import { heroTagline } from '@/content/hero';
import { Badge, Button } from '@/design-system';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';
import { HeroStats } from '../../HeroStats';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <>
      {/* Desktop: two-column layout — boot animation left, bio panel right.
          id="bio" is the anchor target used by DesktopTopbar nav links.
          Hidden on mobile via .desktop CSS rule (max-width: 768px). */}
      <section id="bio" className={`${styles.root} ${styles.desktop}`} data-testid="hero-desktop">
        <div className={styles.left}>
          <HeroBootAnimation variant="desktop" />
        </div>
        <aside className={styles.bio}>
          <h1 className={styles.name} data-testid="hero-name">
            Erik Henrique Alves Cunha
          </h1>
          <p className={styles.tagline}>{heroTagline}</p>
          <p className={styles.meta}>
            <span>
              LOC: <b>Brazil</b>
            </span>
            <span>
              NOW: <b>Betsson</b>
            </span>
            <span>EN/PT/FR/ES</span>
          </p>
          <div className={styles.status}>
            <Badge variant="dot">OPEN_TO_RELOCATION · WORLDWIDE</Badge>
          </div>
          <HeroStats />
          <div className={styles.ctas} data-testid="hero-ctas">
            <Button
              as="a"
              variant="primary"
              href="https://www.linkedin.com/in/erikunha/"
              target="_blank"
              rel="noreferrer"
            >
              EXEC HIRE
            </Button>
            <Button
              as="a"
              variant="secondary"
              href="https://github.com/erikunha"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB ↗
            </Button>
          </div>
        </aside>
        {/* Sysfail overlay — mounted once, desktop-only (event-driven show/hide). */}
        <HeroSystemFailure />
      </section>

      {/* Mobile: stacked layout — boot animation on top, bio below.
          Hidden on desktop via .mobile CSS rule (min-width: 769px).
          No id needed here — anchor target #bio is on the desktop section. */}
      <section className={`${styles.root} ${styles.mobile}`} data-testid="hero-mobile">
        <div className={styles.inner}>
          <HeroBootAnimation variant="mobile" />

          <h1 className={styles.name} data-testid="hero-name">
            Erik Henrique Alves Cunha
          </h1>
          <p className={styles.tagline}>{heroTagline}</p>
          <p className={styles.meta}>
            <span>
              LOC: <b>Brazil</b>
            </span>
            <span>
              NOW: <b>Betsson</b>
            </span>
            <span>EN/PT/FR/ES</span>
          </p>
          <div className={styles.status}>
            <Badge variant="dot">OPEN_TO_RELOCATION · WORLDWIDE</Badge>
          </div>
          <HeroStats />
          <div className={styles.ctas} data-testid="hero-ctas">
            <Button
              as="a"
              variant="primary"
              href="https://www.linkedin.com/in/erikunha/"
              target="_blank"
              rel="noreferrer"
            >
              EXEC HIRE
            </Button>
            <Button
              as="a"
              variant="secondary"
              href="https://github.com/erikunha"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB ↗
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
