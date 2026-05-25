import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Erik Cunha — Staff Full-Stack Engineer · Applied AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        background: '#000000',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 80px',
        fontFamily: 'monospace',
        position: 'relative',
      }}
    >
      {/* scanline overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)',
          opacity: 0.4,
        }}
      />

      <div
        style={{
          color: '#00ff41',
          fontSize: '14px',
          letterSpacing: '0.2em',
          marginBottom: '24px',
          opacity: 0.7,
        }}
      >
        erikunha.dev
      </div>

      <div
        style={{
          color: '#00ff41',
          fontSize: '72px',
          fontWeight: 900,
          letterSpacing: '-0.01em',
          lineHeight: 1.05,
          marginBottom: '20px',
        }}
      >
        ERIK CUNHA
      </div>

      <div
        style={{
          color: '#e6ffe6',
          fontSize: '26px',
          letterSpacing: '0.04em',
          marginBottom: '40px',
        }}
      >
        Staff Full-Stack Engineer · Applied AI
      </div>

      <div
        style={{
          display: 'flex',
          gap: '24px',
          color: '#5ae07b',
          fontSize: '16px',
          letterSpacing: '0.08em',
        }}
      >
        <span>Angular</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>React</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Next.js</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Node.js</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>AWS</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>TypeScript</span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
