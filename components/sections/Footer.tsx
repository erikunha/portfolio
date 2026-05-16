'use client';

import { MatrixRain } from '@/components/responsive/MatrixRain';
import { useBreakpoint } from '@/lib/use-breakpoint';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtUptime(s: number) {
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type DmesgLine = { off: number; msg: ReactNode; ok: boolean };

const DMESG: DmesgLine[] = [
  { off: 0.001, msg: 'init: switching runlevel to 0',                              ok: false },
  { off: 0.142, msg: <>systemd: stopping <b>matrix_rain.daemon</b></>,             ok: true  },
  { off: 0.213, msg: <>systemd: stopping <b>crt_flicker.service</b></>,            ok: true  },
  { off: 0.288, msg: <>kernel: tcp: closing <b>3</b> connections</>,               ok: true  },
  { off: 0.401, msg: <>systemd: reached target <b>Shutdown</b>.</>,                ok: false },
  { off: 0.502, msg: <>systemd: reached target <b>Final Step</b>.</>,              ok: false },
  { off: 0.601, msg: <>kernel: <b>Power down.</b></>,                              ok: false },
];

export function Footer() {
  const { isMobile } = useBreakpoint();
  const uptimeRef = useRef(Date.now());
  const [uptime, setUptime] = useState('00:00:00');
  const [time, setTime] = useState(() => fmtClock(new Date()));
  const [scrollDepth, setScrollDepth] = useState(0);
  const [sectionsSeen, setSectionsSeen] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [commandsRun, setCommandsRun] = useState(0);
  const [dmesgOn, setDmesgOn] = useState<boolean[]>(DMESG.map(() => false));
  const [haltOn, setHaltOn] = useState(false);
  const [dmesgTs, setDmesgTs] = useState<string[]>(DMESG.map(() => ''));
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - uptimeRef.current) / 1000);
      setUptime(fmtUptime(s));
      setTime(fmtClock(new Date()));
    }, 1000);
    return () => clearInterval(id);
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
        const ts = DMESG.map(({ off }) => {
          const t = (base + off).toFixed(3).padStart(9, ' ');
          return `[${t}]`;
        });
        setDmesgTs(ts);
        DMESG.forEach((_, i) => {
          setTimeout(() => {
            setDmesgOn((prev) => prev.map((v, j) => (j === i ? true : v)));
            if (i === DMESG.length - 1) setTimeout(() => setHaltOn(true), 180);
          }, i * 80);
        });
      },
      { threshold: 0.1 },
    );
    obs.observe(footerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <footer className="shutdown" id="shutdown" ref={footerRef}>
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
      <div className="shutdown-inner">
        <div className="sd-banner">
          <span className="sd-init">[SYSTEM SHUTDOWN INITIATED]</span>
          <span className="sd-stamp">
            {'halted at '}
            <b suppressHydrationWarning>{time}</b>
          </span>
        </div>
        <div className="sd-cmdline">
          <span className="sd-prompt">{'erik@portfolio:~$'}</span>
          {' '}
          <span className="sd-cmd">{'shutdown -h now'}</span>
        </div>
        <div className="sd-rule" aria-hidden="true" />

        <div className="sd-grid">
          <div className="sd-panel">
            <header className="sp-head">
              <span className="sp-bar">{'▌'}</span>SESSION_REPORT
            </header>
            <div className="sp-row">
              <span className="sp-k">user</span>
              <span className="sp-v">erik@portfolio</span>
            </div>
            <div className="sp-row">
              <span className="sp-k">uptime</span>
              <span className="sp-v"><b>{uptime}</b></span>
            </div>
            <div className="sp-row">
              <span className="sp-k">{isMobile ? 'scroll' : 'scroll depth'}</span>
              <span className="sp-v">
                <span className="sp-bar2"><i style={{ width: `${scrollDepth}%` }} /></span>
                <b>{scrollDepth}%</b>
              </span>
            </div>
            <div className="sp-row">
              <span className="sp-k">{isMobile ? 'sections' : 'sections seen'}</span>
              <span className="sp-v">
                <b>{sectionsSeen}</b>
                {' / '}
                {totalSections}
              </span>
            </div>
            <div className="sp-row">
              <span className="sp-k">{isMobile ? 'commands' : 'commands run'}</span>
              <span className="sp-v"><b>{commandsRun}</b></span>
            </div>
          </div>

          <div className="sd-panel sd-netstat">
            <header className="sp-head">
              <span className="sp-bar">{'▌'}</span>NETSTAT -AN
            </header>
            {isMobile ? (
              <div className="ns-grid">
                <span className="ns-hdr-cell">State</span>
                <span className="ns-hdr-cell">Endpoint</span>
                <span className="ns-est">EST</span>
                <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
                  github.com/erikunha
                </a>
                <span className="ns-est">EST</span>
                <a href="https://linkedin.com/in/erikunha" target="_blank" rel="noopener noreferrer">
                  linkedin/erikunha
                </a>
                <span className="ns-listen">LSN</span>
                <a href="mailto:erikhenriquealvescunha@gmail.com">
                  erikh…@gmail.com
                </a>
                <span className="ns-est">EST</span>
                <a href="https://erikunha.dev" target="_blank" rel="noopener noreferrer">
                  erikunha.dev
                </a>
              </div>
            ) : (
              <pre>
                <span className="ns-hdr">{'Proto  State        Endpoint'}</span>
                {'\ntcp    '}
                <span className="ns-est">{'ESTABLISHED'}</span>
                {'  '}
                <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
                  {'github.com/erikunha'}
                </a>
                {'\ntcp    '}
                <span className="ns-est">{'ESTABLISHED'}</span>
                {'  '}
                <a href="https://linkedin.com/in/erikunha" target="_blank" rel="noopener noreferrer">
                  {'linkedin.com/in/erikunha'}
                </a>
                {'\ntcp    '}
                <span className="ns-listen">{'LISTEN'}</span>
                {'       '}
                <a href="mailto:erikhenriquealvescunha@gmail.com">
                  {'erikhenriquealvescunha@gmail.com'}
                </a>
                {'\ntcp    '}
                <span className="ns-est">{'ESTABLISHED'}</span>
                {'  '}
                <a href="https://erikunha.dev" target="_blank" rel="noopener noreferrer">
                  {'erikunha.dev'}
                </a>
              </pre>
            )}
          </div>
        </div>

        <ul className="sd-dmesg" aria-label="kernel buffer tail">
          {DMESG.map((line, i) => (
            <li key={i} className={dmesgOn[i] ? 'dm-line on' : 'dm-line'}>
              <span className="dm-t">{dmesgTs[i]}</span>
              <span className="dm-msg">{line.msg}</span>
              {line.ok && <span className="dm-ok">OK</span>}
              {!line.ok && <span className="dm-ok" aria-hidden="true" />}
            </li>
          ))}
        </ul>

        <div className="sd-end">
          <span className={haltOn ? 'sd-halt on' : 'sd-halt'}>[SYSTEM HALTED]</span>
          <span className="sd-halt-hint">
            {isMobile ? 'tap ' : 'press '}
            <button type="button" onClick={() => window.location.reload()}><kbd>R</kbd></button>
            {' to reboot'}
          </span>
        </div>

        <div className="shutdown-copy">
          © 2026 erik cunha · this session ends here · the work doesn&apos;t.
        </div>
      </div>
    </footer>
  );
}
