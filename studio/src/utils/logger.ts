/**
 * Logger utility for Sigilweaver
 * 
 * Provides configurable logging with levels that can be controlled via environment variables.
 * In production builds, debug and info logs are disabled by default.
 * 
 * Usage:
 * ```typescript
 * import { createLogger } from '@/utils/logger';
 * 
 * const logger = createLogger('MyComponent');
 * logger.debug('Detailed debug info', { data });
 * logger.info('General information');
 * logger.warn('Warning message');
 * logger.error('Error occurred', error);
 * ```
 * 
 * Configuration:
 * Set VITE_LOG_LEVEL environment variable to: 'debug' | 'info' | 'warn' | 'error' | 'none'
 * Default: 'debug' in development, 'warn' in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

// Get log level from environment or use defaults
const LOG_LEVEL: LogLevel = 
  (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 
  (import.meta.env.DEV ? 'debug' : 'warn');

// Log level hierarchy
const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const currentLevel = levels[LOG_LEVEL];

/**
 * Create a logger instance with a context prefix
 * 
 * @param context - The component/module name to prefix log messages with
 * @returns Logger instance with debug, info, warn, and error methods
 */
export const createLogger = (context: string) => ({
  /**
   * Debug logging - for detailed diagnostic information
   * Disabled in production builds by default
   */
  debug: (...args: unknown[]) => {
    if (currentLevel <= levels.debug) {
      console.log(`[${context}]`, ...args);
    }
  },

  /**
   * Info logging - for general informational messages
   * Disabled in production builds by default
   */
  info: (...args: unknown[]) => {
    if (currentLevel <= levels.info) {
      console.info(`[${context}]`, ...args);
    }
  },

  /**
   * Warning logging - for potentially problematic situations
   * Enabled in production builds by default
   */
  warn: (...args: unknown[]) => {
    if (currentLevel <= levels.warn) {
      console.warn(`[${context}]`, ...args);
    }
  },

  /**
   * Error logging - for error conditions
   * Always enabled unless LOG_LEVEL is 'none'
   */
  error: (...args: unknown[]) => {
    if (currentLevel <= levels.error) {
      console.error(`[${context}]`, ...args);
    }
  },
});

/**
 * Get the current log level
 */
export const getLogLevel = () => LOG_LEVEL;

/**
 * Check if a specific log level is enabled
 */
export const isLevelEnabled = (level: LogLevel) => currentLevel <= levels[level];
