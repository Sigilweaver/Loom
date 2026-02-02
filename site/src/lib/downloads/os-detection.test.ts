import { describe, it, expect } from 'vitest';
import { detectOS, getOSLabel, type DetectedOS } from './os-detection';

describe('detectOS', () => {
  it('should detect Windows from user agent', () => {
    expect(detectOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe('windows');
    expect(detectOS('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0)')).toBe('windows');
  });

  it('should detect macOS from user agent', () => {
    expect(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')).toBe('mac');
    expect(detectOS('Mozilla/5.0 (Mac; Intel Mac OS X 10.15; rv:109.0)')).toBe('mac');
  });

  it('should detect Linux from user agent', () => {
    expect(detectOS('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')).toBe('linux');
    expect(detectOS('Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0)')).toBe('linux');
  });

  it('should return unknown for unrecognized user agents', () => {
    expect(detectOS('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('unknown');
    expect(detectOS('')).toBe('unknown');
    expect(detectOS('some random string')).toBe('unknown');
  });

  it('should be case insensitive', () => {
    expect(detectOS('windows nt 10.0')).toBe('windows');
    expect(detectOS('LINUX X86_64')).toBe('linux');
    expect(detectOS('macintosh')).toBe('mac');
  });
});

describe('getOSLabel', () => {
  it('should return correct labels for each OS', () => {
    expect(getOSLabel('windows')).toBe('Windows');
    expect(getOSLabel('mac')).toBe('macOS');
    expect(getOSLabel('linux')).toBe('Linux');
    expect(getOSLabel('unknown')).toBe('Your Platform');
  });

  it('should handle unknown values', () => {
    expect(getOSLabel('android' as DetectedOS)).toBe('Your Platform');
  });
});
