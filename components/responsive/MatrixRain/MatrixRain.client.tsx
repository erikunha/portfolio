'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';

type RainTunables = {
  fontSize: number;
  speed: number;
  headColor: string;
  bodyColor: string;
  tailFade: string;
};

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

  const tunablesRef = useRef<RainTunables>({
    fontSize,
    speed,
    headColor,
    bodyColor,
    tailFade,
  });
  useLayoutEffect(() => {
    tunablesRef.current = { fontSize, speed, headColor, bodyColor, tailFade };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
    let w = 0;
    let h = 0;

    function resize() {
      const { fontSize: fs } = tunablesRef.current;
      const r = canvasEl.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvasEl.width = Math.max(1, Math.floor(w * dpr));
      canvasEl.height = Math.max(1, Math.floor(h * dpr));
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxEl.font = `${fs}px "JetBrains Mono", monospace`;
      const newCols = Math.ceil(w / fs);
      const old = drops;
      drops = new Array(newCols);
      for (let i = 0; i < newCols; i++) {
        drops[i] = typeof old[i] === 'number' ? (old[i] as number) : -Math.random() * (h / fs);
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
        const {
          fontSize: fs,
          speed: spd,
          headColor: head,
          bodyColor: body,
          tailFade: tail,
        } = tunablesRef.current;
        ctxEl.fillStyle = tail;
        ctxEl.fillRect(0, 0, w, h);
        for (let i = 0; i < columns; i++) {
          const y = (drops[i] ?? 0) * fs;
          const ch = DIGITS[(Math.random() * DIGITS.length) | 0] ?? '0';
          ctxEl.fillStyle = head;
          ctxEl.fillText(ch, i * fs, y);
          ctxEl.fillStyle = body;
          ctxEl.fillText(ch, i * fs, y - fs);
          if (y > h && Math.random() > 0.975) drops[i] = -Math.random() * 6;
          drops[i] = (drops[i] ?? 0) + spd;
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

    let isIntersecting = false;

    const onMotionChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof (detail as { on?: unknown }).on !== 'boolean') return;
      const on = (detail as { on: boolean }).on;
      if (on) {
        if (!watchRef || isIntersecting) resume();
      } else {
        pause();
        ctxEl.fillStyle = '#000';
        ctxEl.fillRect(0, 0, w, h);
      }
    };
    window.addEventListener('motionchange', onMotionChange);

    const motionOff = !readMotion();

    if (watchRef) {
      running = false;
      const target = watchRef.current;
      if (target && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              isIntersecting = e.isIntersecting;
              if (e.isIntersecting && readMotion()) resume();
              else pause();
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
          window.removeEventListener('motionchange', onMotionChange);
        };
      }
      if (!motionOff) resume();
    } else {
      type IdleWindow = Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
      const idleWin = window as IdleWindow;
      let idleHandle: number | undefined;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const startLoop = () => {
        if (readMotion()) raf = requestAnimationFrame(frame);
      };
      if (!motionOff) {
        if (typeof idleWin.requestIdleCallback === 'function') {
          idleHandle = idleWin.requestIdleCallback(startLoop, { timeout: 2000 });
        } else {
          idleTimer = setTimeout(startLoop, 1000);
        }
      }
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
        if (idleHandle !== undefined) idleWin.cancelIdleCallback?.(idleHandle);
        if (idleTimer !== undefined) clearTimeout(idleTimer);
        clearTimeout(resizeTimer);
        window.removeEventListener('resize', debouncedResize);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('sysfail:start', onSysfailStart);
        window.removeEventListener('sysfail:end', onSysfailEnd);
        window.removeEventListener('motionchange', onMotionChange);
      };
    }

    return () => {
      pause();
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('motionchange', onMotionChange);
    };
  }, [watchRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ ...style, display: 'block', width: '100%', height: '100%' }}
    />
  );
}
