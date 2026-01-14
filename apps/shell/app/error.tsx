'use client';

import { useEffect } from 'react';
import { logger } from '../lib/logger';
import styles from './error.module.css';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error with structured logging
    logger.error('Application error', error, {
      component: 'ErrorBoundary',
      digest: error.digest,
      path: window.location.pathname,
    });
  }, [error]);

  const handleReset = () => {
    logger.info('Error boundary reset attempted', {
      component: 'ErrorBoundary',
      errorMessage: error.message,
    });
    reset();
  };

  return (
    <div className={styles['container']}>
      <div className={styles['content']}>
        <h1 className={styles['title']}>Something went wrong!</h1>
        <p className={styles['message']}>
          An error occurred while loading this page.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className={styles['details']}>
            <summary className={styles['summary']}>Error Details</summary>
            <pre className={styles['error-stack']}>
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
            {error.digest && (
              <p className={styles['digest']}>Error ID: {error.digest}</p>
            )}
          </details>
        )}

        <div className={styles['actions']}>
          <button
            onClick={handleReset}
            className={styles['button-primary']}
            type="button"
          >
            Try again
          </button>
          <a href="/" className={styles['button-secondary']}>
            Go to homepage
          </a>
        </div>
      </div>
    </div>
  );
}
