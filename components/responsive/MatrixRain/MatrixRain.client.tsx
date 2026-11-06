'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';

type RainTunables = {
  fontSize: number;
  speed: number;
  headColor: string;
  bodyColor: string;
  tailFade: string;
};

const DIGITS = '0123456789'.split('');
const FRAME_MS = 1000 / 22;
const RESIZE_DEBOUNCE_MS = 100;
const IDLE_TIMEOUT_MS = 2000;
const IDLE_FALLBACK_MS = 1000;
const VIEW_THRESHOLD = 0.05;
const RESPAWN_THRESHOLD = 0.975;
const RESPAWN_RANGE = 6;

type RunGate = 'ready' | 'motion' | 'visible' | 'calm' | 'inView';
type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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
    let running = false;
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
      resizeTimer = setTimeout(resize, RESIZE_DEBOUNCE_MS);
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
          if (y > h && Math.random() > RESPAWN_THRESHOLD) drops[i] = -Math.random() * RESPAWN_RANGE;
          drops[i] = (drops[i] ?? 0) + spd;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    const gates: Record<RunGate, boolean> = {
      ready: false,
      motion: readMotion(),
      visible: !document.hidden,
      calm: true,
      inView: true,
    };
    function sync() {
      const next = Object.values(gates).every(Boolean);
      if (next === running) return;
      running = next;
      if (next) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    }
    function setGate(gate: RunGate, open: boolean) {
      gates[gate] = open;
      sync();
    }

    const unsubscribeMotion = subscribeMotion((on) => {
      setGate('motion', on);
      if (!on) {
        ctxEl.fillStyle = '#000';
        ctxEl.fillRect(0, 0, w, h);
      }
    });
    const onVisibility = () => setGate('visible', !document.hidden);
    const onSysfailStart = () => setGate('calm', false);
    const onSysfailEnd = () => setGate('calm', true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('sysfail:start', onSysfailStart);
    window.addEventListener('sysfail:end', onSysfailEnd);

    let observer: IntersectionObserver | undefined;
    let idleHandle: number | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const target = watchRef?.current;
    if (watchRef) {
      if (target && 'IntersectionObserver' in window) {
        gates.inView = false;
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) setGate('inView', entry.isIntersecting);
          },
          { threshold: VIEW_THRESHOLD },
        );
        observer.observe(target);
      }
      setGate('ready', true);
    } else {
      const idleWindow = window as IdleWindow;
      const open = () => setGate('ready', true);
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(open, { timeout: IDLE_TIMEOUT_MS });
      } else {
        idleTimer = setTimeout(open, IDLE_FALLBACK_MS);
      }
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      if (idleHandle !== undefined) (window as IdleWindow).cancelIdleCallback?.(idleHandle);
      clearTimeout(idleTimer);
      clearTimeout(resizeTimer);
      unsubscribeMotion();
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('sysfail:start', onSysfailStart);
      window.removeEventListener('sysfail:end', onSysfailEnd);
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
