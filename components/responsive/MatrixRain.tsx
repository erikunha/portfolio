'use client';

import { useEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';

const DIGITS = '0123456789'.split('');
const FRAME_MS = 1000 / 22;

type RainCfg = {
  fontSize?: number;
  speed?: number;
  headColor?: string;
  bodyColor?: string;
  tailFade?: string;
  className?: string;
  style?: React.CSSProperties;
  /** if provided, rain only runs while this ref is intersecting */
  watchRef?: React.RefObject<HTMLElement | null>;
};

export function MatrixRain({
  fontSize = 16,
  speed = 0.7,
  headColor = '#1d6a2a',
  bodyColor = '#072810',
  tailFade = 'rgba(0,0,0,0.10)',
  className,
  style,
  watchRef,
}: RainCfg) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!readMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasEl = canvas;
    const ctxEl = ctx;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let columns = 0;
    let drops: number[] = [];
    let running = true;
    let raf = 0;
    let last = 0;
    // cached CSS dimensions — updated in resize(), used in frame() without layout query
    let w = 0;
    let h = 0;

    function resize() {
      const r = canvasEl.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvasEl.width = Math.max(1, Math.floor(w * dpr));
      canvasEl.height = Math.max(1, Math.floor(h * dpr));
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxEl.font = `${fontSize}px "JetBrains Mono", monospace`;
      const newCols = Math.ceil(w / fontSize);
      const old = drops;
      drops = new Array(newCols);
      for (let i = 0; i < newCols; i++) {
        drops[i] =
          typeof old[i] === 'number' ? (old[i] as number) : -Math.random() * (h / fontSize);
      }
      columns = newCols;
      ctxEl.fillStyle = '#000';
      ctxEl.fillRect(0, 0, w, h);
    }

    resize();

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    function debouncedResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 100);
    }
    window.addEventListener('resize', debouncedResize, { passive: true });

    function frame(ts: number) {
      if (!running) return;
      if (ts - last >= FRAME_MS) {
        last = ts;
        ctxEl.fillStyle = tailFade;
        ctxEl.fillRect(0, 0, w, h);
        for (let i = 0; i < columns; i++) {
          const y = (drops[i] ?? 0) * fontSize;
          const ch = DIGITS[(Math.random() * DIGITS.length) | 0] ?? '0';
          ctxEl.fillStyle = headColor;
          ctxEl.fillText(ch, i * fontSize, y);
          ctxEl.fillStyle = bodyColor;
          ctxEl.fillText(ch, i * fontSize, y - fontSize);
          if (y > h && Math.random() > 0.975) drops[i] = -Math.random() * 6;
          drops[i] = (drops[i] ?? 0) + speed;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function pause() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function resume() {
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    if (watchRef) {
      running = false;
      const target = watchRef.current;
      if (target && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              e.isIntersecting ? resume() : pause();
            });
          },
          { threshold: 0.05 },
        );
        io.observe(target);
        return () => {
          io.disconnect();
          pause();
          clearTimeout(resizeTimer);
          window.removeEventListener('resize', debouncedResize);
        };
      }
      // fallback if no IO support — start immediately
      resume();
    } else {
      raf = requestAnimationFrame(frame);
      const onVisibility = () => {
        document.hidden ? pause() : resume();
      };
      document.addEventListener('visibilitychange', onVisibility);
      const onSysfailStart = () => pause();
      const onSysfailEnd = () => resume();
      window.addEventListener('sysfail:start', onSysfailStart);
      window.addEventListener('sysfail:end', onSysfailEnd);
      return () => {
        pause();
        clearTimeout(resizeTimer);
        window.removeEventListener('resize', debouncedResize);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('sysfail:start', onSysfailStart);
        window.removeEventListener('sysfail:end', onSysfailEnd);
      };
    }

    return () => {
      pause();
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [fontSize, speed, headColor, bodyColor, tailFade, watchRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
