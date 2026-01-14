/**
 * Structured Logging System
 * Zero-dependency, production-ready logging with console output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: unknown;
  requestId?: string;
  userId?: string;
  path?: string;
  component?: string;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    digest?: string;
  };
}

class Logger {
  private isDevelopment = process.env['NODE_ENV'] === 'development';

  /**
   * Format log entry as structured JSON
   */
  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          digest: (error as Error & { digest?: string }).digest,
        },
      }),
    };
  }

  /**
   * Output to console (development) or stdout (production server)
   */
  private output(entry: LogEntry): void {
    const formattedEntry = JSON.stringify(entry);

    if (this.isDevelopment) {
      // Pretty print in development
      const emoji = {
        debug: '🔍',
        info: '📊',
        warn: '⚠️',
        error: '❌',
        fatal: '💀',
      };

      const consoleMethod =
        entry.level === 'fatal' || entry.level === 'error'
          ? 'error'
          : entry.level === 'warn'
            ? 'warn'
            : 'info';

      // eslint-disable-next-line no-console
      console[consoleMethod](
        `${emoji[entry.level]} [${entry.level.toUpperCase()}]`,
        entry.message,
        entry.context || '',
        entry.error || '',
      );
    } else {
      // Structured JSON in production
      console.info(formattedEntry);
    }
  }

  /**
   * Debug level - verbose logging
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) {
      return;
    }
    const entry = this.formatLog('debug', message, context);
    this.output(entry);
  }

  /**
   * Info level - general information
   */
  info(message: string, context?: LogContext): void {
    const entry = this.formatLog('info', message, context);
    this.output(entry);
  }

  /**
   * Warn level - warning messages
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.formatLog('warn', message, context);
    this.output(entry);
  }

  /**
   * Error level - recoverable errors
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.formatLog('error', message, context, error);
    this.output(entry);
  }

  /**
   * Fatal level - unrecoverable errors
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    const entry = this.formatLog('fatal', message, context, error);
    this.output(entry);
  }

  /**
   * Create a child logger with persistent context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    const originalFormatLog = childLogger.formatLog.bind(childLogger);

    childLogger.formatLog = (level, message, additionalContext, error) => {
      return originalFormatLog(
        level,
        message,
        { ...context, ...additionalContext },
        error,
      );
    };

    return childLogger;
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logFatal = logger.fatal.bind(logger);
