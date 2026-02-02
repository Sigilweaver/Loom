/**
 * OS Detection
 * Pure functions for detecting operating system from user agent
 */

export type DetectedOS = 'windows' | 'mac' | 'linux' | 'unknown';

/**
 * Detect the user's operating system from user agent string
 */
export function detectOS(userAgent: string): DetectedOS {
  if (/Windows/i.test(userAgent)) {
    return 'windows';
  }
  if (/Mac|Macintosh/i.test(userAgent)) {
    return 'mac';
  }
  if (/Linux/i.test(userAgent)) {
    return 'linux';
  }
  return 'unknown';
}

/**
 * Get a display label for the detected OS
 */
export function getOSLabel(os: DetectedOS): string {
  switch (os) {
    case 'windows':
      return 'Windows';
    case 'mac':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return 'Your Platform';
  }
}
