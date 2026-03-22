import { describe, it, expect } from 'vitest';
import {
  findAssetForOS,
  getOsMeta,
  formatFileSize,
  truncateHash,
  formatReleaseDate,
  calculatePagination,
} from './assets';
import type { DownloadsData } from './types';

const mockDownloadsData: DownloadsData = {
  version: '0.1.0',
  variants: {
    full: [
      {
        os: 'windows',
        arch: 'x64',
        kind: 'full',
        fileName: 'sigilweaver-loom-0.1.0.exe',
        url: 'https://example.com/sigilweaver-loom-0.1.0.exe',
        size: 104857600, // 100 MB
        sha256: 'abc123def456',
      },
      {
        os: 'mac',
        arch: 'x64',
        kind: 'full',
        fileName: 'sigilweaver-loom-0.1.0.dmg',
        url: 'https://example.com/sigilweaver-loom-0.1.0.dmg',
        size: 83886080, // 80 MB
        sha256: 'def456abc123',
      },
      {
        os: 'linux',
        arch: 'x64',
        kind: 'full',
        fileName: 'sigilweaver-loom-0.1.0.AppImage',
        url: 'https://example.com/sigilweaver-loom-0.1.0.AppImage',
        size: 94371840, // 90 MB
        sha256: 'ghi789jkl012',
      },
    ],
    client: [],
  },
};

describe('findAssetForOS', () => {
  it('should find Windows .exe asset', () => {
    const asset = findAssetForOS(mockDownloadsData, 'windows');
    expect(asset).toBeDefined();
    expect(asset?.os).toBe('windows');
    expect(asset?.fileName).toContain('.exe');
  });

  it('should find macOS asset', () => {
    const asset = findAssetForOS(mockDownloadsData, 'mac');
    expect(asset).toBeDefined();
    expect(asset?.os).toBe('mac');
  });

  it('should find Linux AppImage asset', () => {
    const asset = findAssetForOS(mockDownloadsData, 'linux');
    expect(asset).toBeDefined();
    expect(asset?.os).toBe('linux');
    expect(asset?.fileName).toContain('.AppImage');
  });

  it('should return undefined for unknown OS', () => {
    const asset = findAssetForOS(mockDownloadsData, 'unknown');
    expect(asset).toBeUndefined();
  });

  it('should return undefined when no variants exist', () => {
    const emptyData: DownloadsData = {
      version: '0.1.0',
      variants: { full: [], client: [] },
    };
    expect(findAssetForOS(emptyData, 'windows')).toBeUndefined();
  });
});

describe('getOsMeta', () => {
  it('should return Windows metadata with security note', () => {
    const meta = getOsMeta('windows', 'sigilweaver-loom.exe');
    expect(meta.name).toBe('Windows');
    expect(meta.icon).toContain('microsoft-windows');
    expect(meta.note).toContain('Unsigned build');
  });

  it('should return Linux AppImage metadata', () => {
    const meta = getOsMeta('linux', 'sigilweaver-loom.AppImage');
    expect(meta.name).toBe('Linux (AppImage)');
    expect(meta.icon).toContain('linux');
    expect(meta.note).toContain('chmod +x');
  });

  it('should return Linux Snap metadata', () => {
    const meta = getOsMeta('linux', 'sigilweaver-loom.snap');
    expect(meta.name).toBe('Linux (Snap)');
    expect(meta.note).toContain('snapd');
  });

  it('should return macOS metadata with security note', () => {
    const meta = getOsMeta('mac', 'sigilweaver-loom.dmg');
    expect(meta.name).toBe('macOS');
    expect(meta.icon).toContain('apple');
    expect(meta.note).toContain('Right-click');
  });

  it('should handle darwin OS identifier', () => {
    const meta = getOsMeta('darwin', 'sigilweaver-loom.dmg');
    expect(meta.name).toBe('macOS');
  });

  it('should return web metadata for unknown OS', () => {
    const meta = getOsMeta('web', 'bundle.zip');
    expect(meta.name).toBe('Web Bundle');
    expect(meta.note).toContain('Static files');
  });
});

describe('formatFileSize', () => {
  it('should format bytes to MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0'); // 1 MB
    expect(formatFileSize(104857600)).toBe('100.0'); // 100 MB
    expect(formatFileSize(52428800)).toBe('50.0'); // 50 MB
  });

  it('should handle decimal values', () => {
    expect(formatFileSize(1572864)).toBe('1.5'); // 1.5 MB
    expect(formatFileSize(5242880)).toBe('5.0'); // 5 MB
  });

  it('should handle small files', () => {
    expect(formatFileSize(524288)).toBe('0.5'); // 0.5 MB
    expect(formatFileSize(104857)).toBe('0.1'); // ~0.1 MB
  });
});

describe('truncateHash', () => {
  it('should truncate long hashes', () => {
    const hash = 'abc123def456ghi789jkl012mno345pqr678';
    expect(truncateHash(hash)).toBe('abc123de...45pqr678');
  });

  it('should not truncate short hashes', () => {
    const hash = 'abc123';
    expect(truncateHash(hash)).toBe('abc123');
  });

  it('should support custom start/end lengths', () => {
    const hash = 'abc123def456ghi789';
    expect(truncateHash(hash, 4, 4)).toBe('abc1...i789');
    expect(truncateHash(hash, 2, 2)).toBe('ab...89');
  });

  it('should handle edge cases', () => {
    expect(truncateHash('', 8, 8)).toBe('');
    expect(truncateHash('abcd1234abcd1234', 8, 8)).toBe('abcd1234abcd1234');
  });
});

describe('formatReleaseDate', () => {
  it('should format ISO date to readable format', () => {
    const result = formatReleaseDate('2025-01-15');
    expect(result).toContain('January');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should handle full ISO datetime', () => {
    const result = formatReleaseDate('2025-06-20T14:30:00Z');
    expect(result).toContain('June');
    expect(result).toContain('20');
    expect(result).toContain('2025');
  });
});

describe('calculatePagination', () => {
  it('should calculate pagination for single page', () => {
    const result = calculatePagination(5, 1, 10);
    expect(result.totalPages).toBe(1);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(5);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(false);
  });

  it('should calculate pagination for multiple pages', () => {
    const result = calculatePagination(25, 1, 10);
    expect(result.totalPages).toBe(3);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPage).toBe(false);
  });

  it('should handle middle page', () => {
    const result = calculatePagination(25, 2, 10);
    expect(result.startIndex).toBe(10);
    expect(result.endIndex).toBe(20);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPage).toBe(true);
  });

  it('should handle last page', () => {
    const result = calculatePagination(25, 3, 10);
    expect(result.startIndex).toBe(20);
    expect(result.endIndex).toBe(25);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(true);
  });

  it('should handle empty list', () => {
    const result = calculatePagination(0, 1, 10);
    expect(result.totalPages).toBe(0);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
  });
});
