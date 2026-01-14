'use client';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

export default function OfflinePage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: 'var(--color-background, #000)',
        color: 'var(--color-text, #fff)',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        You are offline
      </h1>
      <p
        style={{
          fontSize: '1.125rem',
          marginBottom: '2rem',
          maxWidth: '600px',
        }}
      >
        It looks like you've lost your internet connection. Please check your
        network and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: 'var(--color-brand-primary, #1aff1a)',
          color: 'var(--color-background, #000)',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
