'use client';

import { useEffect, useRef, useState } from 'react';
import { MatrixRain } from '@/components/responsive/MatrixRain';
import { dmesgLines } from '@/content/dmesg';
import { useBreakpoint } from '@/lib/use-breakpoint.client';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtUptime(s: number) {
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function Footer() {
  const { isMobile } = useBreakpoint();
  const uptimeRef = useRef(Date.now());
  const [uptime, setUptime] = useState('00:00:00');
  const [time, setTime] = useState(() => fmtClock(new Date()));
  const [scrollDepth, setScrollDepth] = useState(0);
  const [sectionsSeen, setSectionsSeen] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [commandsRun, setCommandsRun] = useState(0);
  // The dmesg boot sequence is CSS-timed: a single `booted` flag flips the
  // whole list from hidden to revealing. Each <li> staggers via its own
  // `animation-delay` (see `.dmesg-line` / `.dmesg-booted` in components.css),
  // and the halt plate uses the trailing delay. This collapses what used to be
  // a ~8-call staggered setState storm into one state update.
  const [booted, setBooted] = useState(false);
  const [dmesgTs, setDmesgTs] = useState<string[]>(dmesgLines.map(() => ''));
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function tick() {
      const s = Math.floor((Date.now() - uptimeRef.current) / 1000);
      setUptime(fmtUptime(s));
      setTime(fmtClock(new Date()));
    }

    function startClock() {
      id = setInterval(tick, 1000);
    }

    function onVisibility() {
      if (document.hidden) {
        if (id !== null) {
          clearInterval(id);
          id = null;
        }
      } else {
        startClock();
      }
    }

    startClock();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (id !== null) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const inc = () => setCommandsRun((n) => n + 1);
    window.addEventListener('shell-cmd-run', inc);
    return () => window.removeEventListener('shell-cmd-run', inc);
  }, []);

  useEffect(() => {
    const maxScroll = { v: 0 };
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      if (total <= 0) return;
      const pct = Math.min(100, Math.round((doc.scrollTop / total) * 100));
      if (pct > maxScroll.v) {
        maxScroll.v = pct;
        setScrollDepth(pct);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('main > section'));
    setTotalSections(sections.length);
    const seen = new Set<Element>();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen.has(e.target)) {
            seen.add(e.target);
            setSectionsSeen(seen.size);
          }
        });
      },
      { threshold: 0.25 },
    );
    for (const s of sections) obs.observe(s);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!footerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        obs.disconnect();
        const base = (Date.now() - uptimeRef.current) / 1000;
        const ts = dmesgLines.map(({ off }) => {
          const t = (base + off).toFixed(3).padStart(9, ' ');
          return `[${t}]`;
        });
        setDmesgTs(ts);
        // One state flip — the staggered reveal is CSS-driven from here.
        setBooted(true);
      },
      { threshold: 0.1 },
    );
    obs.observe(footerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <footer
      className="site-footer border-t-0 pb-[20px] bg-transparent relative z-[1] overflow-hidden max-[900px]:pt-0 max-[900px]:pb-[calc(40px+env(safe-area-inset-bottom,0px))] max-[900px]:px-[20px] max-[768px]:py-7 max-[768px]:px-[20px]"
      id="shutdown"
      ref={footerRef}
    >
      <MatrixRain
        fontSize={14}
        speed={0.9}
        headColor="#8FE0A0"
        bodyColor="#1F8A3A"
        tailFade="rgba(0,0,0,0.14)"
        watchRef={footerRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.22,
          maskImage: 'linear-gradient(180deg, transparent 0%, #000 18%, #000 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 18%, #000 100%)',
        }}
      />
      <div
        className="relative z-[1] max-w-[1200px] mx-auto px-[20px] font-mono"
        style={{ textShadow: '0 0 4px #000, 0 0 8px rgba(0,0,0,0.6)' }}
      >
        {/* Banner */}
        <div className="flex items-baseline justify-between gap-6 flex-wrap mb-2 max-[768px]:flex-col max-[768px]:gap-1">
          <span
            className="text-primary-500 font-bold tracking-[0.06em] text-sm max-md:text-xs"
            style={{ textShadow: '0 0 8px rgba(0,255,65,0.35)' }}
          >
            [SYSTEM SHUTDOWN INITIATED]
          </span>
          <span className="text-primary-400 text-xs max-md:text-[10px] tracking-[0.14em] uppercase">
            {'halted at '}
            <b
              suppressHydrationWarning
              className="text-tertiary-50 font-bold ml-1.5 tracking-[0.04em] tabular-nums"
            >
              {time}
            </b>
          </span>
        </div>

        {/* Cmdline */}
        <div className="text-sm max-md:text-xs mb-[14px] text-tertiary-50">
          <span className="text-primary-400">{'erik@portfolio:~$'}</span>{' '}
          <span className="text-tertiary-50">{'shutdown -h now'}</span>
        </div>

        {/* Rule */}
        <div
          className="border-t border-dashed border-primary-subtle mb-[22px]"
          aria-hidden="true"
        />

        {/* Grid — 2 panels */}
        <div className="grid grid-cols-[1fr_1.15fr] gap-[18px] mb-[26px] max-[900px]:grid-cols-1">
          {/* SESSION_REPORT panel */}
          <div
            className="border border-primary-subtle p-[14px_16px_16px] relative min-w-0 max-[768px]:p-[12px_14px_14px] max-[768px]:mb-2.5"
            style={{ background: 'linear-gradient(180deg, rgba(0,255,65,0.025), rgba(0,0,0,0))' }}
          >
            <header className="text-primary-500 font-bold text-xs tracking-[0.18em] mb-3 flex items-baseline gap-1.5 max-[768px]:tracking-[0.16em]">
              <span className="text-primary-500">{'▌'}</span>SESSION_REPORT
            </header>
            <div className="grid grid-cols-[130px_1fr] gap-3 text-sm max-md:text-xs leading-[1.95] max-md:leading-[1.5] items-center max-[900px]:grid-cols-[110px_1fr] max-[768px]:grid-cols-[100px_1fr] max-[768px]:gap-x-2.5 max-[768px]:gap-y-0.5 max-[560px]:grid-cols-[92px_1fr] max-[560px]:gap-x-2">
              <span className="text-primary-400 tracking-[0.04em]">user</span>
              <span className="text-tertiary-50 tabular-nums">erik@portfolio</span>
              <span className="text-primary-400 tracking-[0.04em]">uptime</span>
              <span className="text-tertiary-50 tabular-nums">
                <b className="text-primary-500 font-bold tabular-nums">{uptime}</b>
              </span>
              <span className="text-primary-400 tracking-[0.04em]">
                {isMobile ? 'scroll' : 'scroll depth'}
              </span>
              <span className="text-tertiary-50 tabular-nums">
                {/* sp-bar in components.css */}
                <span className="sp-bar">
                  <i style={{ width: `${scrollDepth}%` }} />
                </span>
                <b className="text-primary-500 font-bold tabular-nums">{scrollDepth}%</b>
              </span>
              <span className="text-primary-400 tracking-[0.04em]">
                {isMobile ? 'sections' : 'sections seen'}
              </span>
              <span className="text-tertiary-50 tabular-nums">
                <b className="text-primary-500 font-bold tabular-nums">{sectionsSeen}</b>
                {' / '}
                {totalSections}
              </span>
              <span className="text-primary-400 tracking-[0.04em]">
                {isMobile ? 'commands' : 'commands run'}
              </span>
              <span className="text-tertiary-50 tabular-nums">
                <b className="text-primary-500 font-bold tabular-nums">{commandsRun}</b>
              </span>
            </div>
          </div>

          {/* NETSTAT panel */}
          <div
            className="border border-primary-subtle p-[14px_16px_16px] relative min-w-0 max-[768px]:p-[12px_14px_14px] max-[768px]:mb-2.5"
            style={{ background: 'linear-gradient(180deg, rgba(0,255,65,0.025), rgba(0,0,0,0))' }}
          >
            <header className="text-primary-500 font-bold text-xs tracking-[0.18em] mb-3 flex items-baseline gap-1.5">
              <span className="text-primary-500">{'▌'}</span>NETSTAT -AN
            </header>
            {isMobile ? (
              <div className="grid grid-cols-[28px_90px_minmax(0,1fr)] gap-x-[28px] items-center text-xs max-[768px]:grid-cols-[34px_74px_minmax(0,1fr)] max-[768px]:gap-x-1.5 max-[768px]:text-[11px]">
                <span className="text-primary-400 tracking-[0.06em]">Proto</span>
                <span className="text-primary-400 tracking-[0.06em]">State</span>
                <span className="text-primary-400 tracking-[0.06em]">Endpoint</span>
                <span className="text-primary-400">tcp</span>
                <span className="text-primary-500 font-bold flex items-center min-h-8">
                  ESTABLISHED
                </span>
                <a
                  href="https://github.com/erikunha"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="netstat-link flex items-center min-h-8 max-[768px]:overflow-hidden max-[768px]:text-ellipsis max-[768px]:whitespace-nowrap"
                >
                  github.com/erikunha
                </a>
                <span className="text-primary-400">tcp</span>
                <span className="text-quinary-300 font-bold flex items-center min-h-8">LISTEN</span>
                <a
                  href="https://linkedin.com/in/erikunha"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="netstat-link flex items-center min-h-8 max-[768px]:overflow-hidden max-[768px]:text-ellipsis max-[768px]:whitespace-nowrap"
                >
                  linkedin.com/in/erikunha
                </a>
                <span className="text-primary-400">tcp</span>
                <span className="text-primary-500 font-bold flex items-center min-h-8">
                  ESTABLISHED
                </span>
                <a
                  href="https://erikunha.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="netstat-link flex items-center min-h-8 max-[768px]:overflow-hidden max-[768px]:text-ellipsis max-[768px]:whitespace-nowrap"
                >
                  erikunha.dev
                </a>
              </div>
            ) : (
              <pre className="m-0 font-mono text-sm leading-[1.95] text-tertiary-50 whitespace-pre overflow-x-auto max-[900px]:text-sm max-md:text-xs">
                <span className="text-primary-400">{'Proto  State        Endpoint'}</span>
                {[
                  {
                    state: 'ESTABLISHED',
                    cls: 'text-primary-500 font-bold',
                    href: 'https://github.com/erikunha',
                    label: 'github.com/erikunha',
                    external: true,
                  },
                  {
                    state: 'LISTEN',
                    cls: 'text-quinary-300 font-bold',
                    href: 'https://linkedin.com/in/erikunha',
                    label: 'linkedin.com/in/erikunha',
                    external: true,
                  },
                  {
                    state: 'ESTABLISHED',
                    cls: 'text-primary-500 font-bold',
                    href: 'https://erikunha.dev',
                    label: 'erikunha.dev',
                    external: true,
                  },
                ].map((e) => (
                  <span key={e.href}>
                    {'\ntcp    '}
                    <span className={e.cls}>{e.state}</span>
                    {' '.repeat(13 - e.state.length)}
                    <a
                      href={e.href}
                      className="netstat-link"
                      {...(e.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {e.label}
                    </a>
                  </span>
                ))}
              </pre>
            )}
          </div>
        </div>

        {/* dmesg list — dmesg-booted / dmesg-line in components.css */}
        <ul
          className={`list-none m-0 mb-6 p-0 text-sm leading-[1.85]${booted ? ' dmesg-booted' : ''}`}
          aria-label="kernel buffer tail"
        >
          {dmesgLines.map((line, i) => (
            <li
              key={line.off}
              className="dmesg-line grid grid-cols-[92px_1fr_auto] gap-x-[14px] items-baseline text-tertiary-50 max-[900px]:grid-cols-[72px_1fr_auto] max-[900px]:gap-x-2.5 max-[900px]:text-sm max-[768px]:grid-cols-[60px_1fr_auto] max-[768px]:gap-x-1.5 max-md:text-[11px]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-primary-400 tabular-nums whitespace-nowrap">{dmesgTs[i]}</span>
              <span className="text-tertiary-50">
                {line.prefix}
                {line.bold && <b className="text-primary-500 font-bold">{line.bold}</b>}
                {line.suffix}
              </span>
              {line.ok && (
                <span className="text-primary-500 font-bold tracking-[0.12em] text-xs max-md:text-[11px]">
                  OK
                </span>
              )}
              {!line.ok && (
                <span
                  className="text-primary-500 font-bold tracking-[0.12em] text-xs"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ul>

        {/* Halt plate + hint — halt-booted / halt-plate / halt-hint in components.css */}
        <div
          className={`mt-6 flex items-center flex-wrap gap-x-4 gap-y-2.5 max-md:flex-col max-md:items-start${booted ? ' halt-booted' : ''}`}
        >
          <span className="halt-plate inline-block shrink-0 bg-primary-500 text-black font-bold text-sm max-md:text-xs tracking-[0.16em] px-3 py-[5px] leading-none whitespace-nowrap">
            [SYSTEM HALTED]
          </span>
          <span className="halt-hint shrink-0 text-primary-400 text-xs max-md:text-[10px] tracking-[0.12em] whitespace-nowrap">
            {isMobile ? 'tap ' : 'press '}
            <button type="button" onClick={() => window.location.reload()}>
              {/* kbd-key class in components.css */}
              <kbd className="kbd-key">R</kbd>
            </button>
            {' to reboot'}
          </span>
        </div>

        {/* Copyright */}
        <div className="text-primary-400 text-sm max-md:text-xs mt-[22px] tracking-[0.04em] opacity-85">
          © 2026 erik cunha · this session ends here · the work doesn&apos;t.
        </div>
      </div>
    </footer>
  );
}
