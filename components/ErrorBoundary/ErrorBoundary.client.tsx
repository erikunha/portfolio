'use client';

// components/ErrorBoundary/ErrorBoundary.client.tsx
// Wraps client islands so a single failure doesn't crash the entire page.

import { Component, type ReactNode } from 'react';

import { buildLogPayload } from '@/lib/error-bridge.client';

interface Props {
  children: ReactNode;
  /** Fallback shown when an error is caught. Defaults to nothing (silent). */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Retain console.error for dev visibility (this client-side console.* is
    // intentionally not migrated in Phase 2b per spec §6).
    console.error('[ErrorBoundary] client island crashed:', error, info.componentStack);
    // Also POST to /api/log so it lands in Upstash for retrospective triage.
    if (typeof window !== 'undefined') {
      void fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildLogPayload(
            `[ErrorBoundary] ${error.message}`,
            error.stack ?? info.componentStack ?? undefined,
          ),
        ),
        keepalive: true,
      }).catch(() => {
        // Intentional no-op.
      });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="eb-fallback" role="alert" aria-live="polite">
            <span className="gt">!</span>
            {' component unavailable'}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
