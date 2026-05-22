'use client';

import { useEffect, useRef, useState } from 'react';
import { MatrixRain } from '@/components/responsive/MatrixRain.client';
import { dmesgLines } from '@/content/dmesg';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import styles from './Footer.module.css';

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
  // `animation-delay` (see `.dmLine` in Footer.module.css), and the halt
  // plate uses the trailing delay. This collapses what used to be a ~8-call
  // staggered setState storm into one state update.
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
    <footer className={styles.root} id="shutdown" ref={footerRef}>
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
      <div className={styles.inner}>
        <div className={styles.banner}>
          <span className={styles.init}>[SYSTEM SHUTDOWN INITIATED]</span>
          <span className={styles.stamp}>
            {'halted at '}
            <b suppressHydrationWarning>{time}</b>
          </span>
        </div>
        <div className={styles.cmdline}>
          <span className={styles.sdPrompt}>{'erik@portfolio:~$'}</span>{' '}
          <span className={styles.sdCmd}>{'shutdown -h now'}</span>
        </div>
        <div className={styles.rule} aria-hidden="true" />

        <div className={styles.grid}>
          <div className={styles.panel}>
            <header className={styles.spHead}>
              <span className={styles.spBar}>{'▌'}</span>SESSION_REPORT
            </header>
            <div className={styles.spRow}>
              <span className={styles.spK}>user</span>
              <span className={styles.spV}>erik@portfolio</span>
            </div>
            <div className={styles.spRow}>
              <span className={styles.spK}>uptime</span>
              <span className={styles.spV}>
                <b>{uptime}</b>
              </span>
            </div>
            <div className={styles.spRow}>
              <span className={styles.spK}>{isMobile ? 'scroll' : 'scroll depth'}</span>
              <span className={styles.spV}>
                <span className={styles.spBar2}>
                  <i style={{ width: `${scrollDepth}%` }} />
                </span>
                <b>{scrollDepth}%</b>
              </span>
            </div>
            <div className={styles.spRow}>
              <span className={styles.spK}>{isMobile ? 'sections' : 'sections seen'}</span>
              <span className={styles.spV}>
                <b>{sectionsSeen}</b>
                {' / '}
                {totalSections}
              </span>
            </div>
            <div className={styles.spRow}>
              <span className={styles.spK}>{isMobile ? 'commands' : 'commands run'}</span>
              <span className={styles.spV}>
                <b>{commandsRun}</b>
              </span>
            </div>
          </div>

          <div className={`${styles.panel} ${styles.netstat}`}>
            <header className={styles.spHead}>
              <span className={styles.spBar}>{'▌'}</span>NETSTAT -AN
            </header>
            {isMobile ? (
              <div className={styles.nsGrid}>
                <span className={styles.nsHdrCell}>Proto</span>
                <span className={styles.nsHdrCell}>State</span>
                <span className={styles.nsHdrCell}>Endpoint</span>
                <span className={styles.nsProto}>tcp</span>
                <span className={styles.nsEst}>ESTABLISHED</span>
                <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
                  github.com/erikunha
                </a>
                <span className={styles.nsProto}>tcp</span>
                <span className={styles.nsListen}>LISTEN</span>
                <a
                  href="https://linkedin.com/in/erikunha"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  linkedin.com/in/erikunha
                </a>
                <span className={styles.nsProto}>tcp</span>
                <span className={styles.nsEst}>ESTABLISHED</span>
                <a href="https://erikunha.dev" target="_blank" rel="noopener noreferrer">
                  erikunha.dev
                </a>
              </div>
            ) : (
              <pre>
                <span className={styles.nsHdr}>{'Proto  State        Endpoint'}</span>
                {[
                  {
                    state: 'ESTABLISHED',
                    cls: styles.nsEst,
                    href: 'https://github.com/erikunha',
                    label: 'github.com/erikunha',
                    external: true,
                  },
                  {
                    state: 'LISTEN',
                    cls: styles.nsListen,
                    href: 'https://linkedin.com/in/erikunha',
                    label: 'linkedin.com/in/erikunha',
                    external: true,
                  },
                  {
                    state: 'ESTABLISHED',
                    cls: styles.nsEst,
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

        <ul
          className={booted ? `${styles.dmesg} ${styles.booted}` : styles.dmesg}
          aria-label="kernel buffer tail"
        >
          {dmesgLines.map((line, i) => (
            <li key={line.off} className={styles.dmLine} style={{ animationDelay: `${i * 80}ms` }}>
              <span className={styles.dmT}>{dmesgTs[i]}</span>
              <span className={styles.dmMsg}>
                {line.prefix}
                {line.bold && <b>{line.bold}</b>}
                {line.suffix}
              </span>
              {line.ok && <span className={styles.dmOk}>OK</span>}
              {!line.ok && <span className={styles.dmOk} aria-hidden="true" />}
            </li>
          ))}
        </ul>

        <div className={booted ? `${styles.end} ${styles.booted}` : styles.end}>
          <span className={styles.halt}>[SYSTEM HALTED]</span>
          <span className={styles.haltHint}>
            {isMobile ? 'tap ' : 'press '}
            <button type="button" onClick={() => window.location.reload()}>
              <kbd>R</kbd>
            </button>
            {' to reboot'}
          </span>
        </div>

        <div className={styles.copy}>
          © 2026 erik cunha · this session ends here · the work doesn&apos;t.
        </div>
      </div>
    </footer>
  );
}
