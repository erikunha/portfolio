import { CRTOverlay } from '@/components/responsive/CRTOverlay';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found">
      <CRTOverlay />
      <pre style={{ lineHeight: 1.8, fontSize: 'clamp(0.8rem, 2vw, 1rem)' }}>
        <span style={{ color: 'var(--signal)', opacity: 0.6 }}>{'erik@portfolio:~$ '}</span>
        <span>{'navigate /dev/null'}</span>
        {'\n'}
        <span>{'bash: navigate: /dev/null: Not a directory'}</span>
        {'\n\n'}
        <span style={{ color: 'var(--signal)' }}>{'ERROR 404 \u2014 PAGE_NOT_FOUND'}</span>
        {'\n\n'}
        <Link
          href="/"
          style={{
            color: 'var(--signal)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--signal)',
          }}
        >
          {'\u2190 cd ~'}
        </Link>
        <span style={{ opacity: 0.5 }}>{'  \u00b7  return to portfolio'}</span>
      </pre>
    </main>
  );
}
