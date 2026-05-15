'use client';

// components/ErrorBoundary.client.tsx
// Wraps client islands so a single failure doesn't crash the entire page.
// Named *.client.tsx per CLAUDE.md convention.

import { Component, type ReactNode } from 'react';

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
    console.error('[ErrorBoundary] client island crashed:', error, info.componentStack);
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
