/**
 * Asset Utilities
 * Pure functions for working with download assets
 */

import type { DownloadAsset, DownloadsData, OsMeta } from './types';
import type { DetectedOS } from './os-detection';

/**
 * Find the best matching asset for a given OS
 */
export function findAssetForOS(
  data: DownloadsData,
  os: DetectedOS
): DownloadAsset | undefined {
  const fullVariants = data.variants.full;
  if (!fullVariants || fullVariants.length === 0) {
    return undefined;
  }

  switch (os) {
    case 'windows':
      return fullVariants.find(a => a.os === 'windows' && a.fileName.endsWith('.exe'));
    case 'mac':
      return fullVariants.find(a => a.os === 'mac' || a.os === 'darwin' || a.os === 'macos');
    case 'linux':
      return fullVariants.find(a => a.os === 'linux' && a.fileName.endsWith('.AppImage'));
    default:
      return undefined;
  }
}

/**
 * Get OS-specific metadata for display
 */
export function getOsMeta(os: string, fileName: string): OsMeta {
  const icons: Record<string, string> = {
    windows: `<img src="https://api.iconify.design/mdi/microsoft-windows.svg?color=%23FDB022" alt="Windows" class="w-8 h-8">`,
    linux: `<img src="https://api.iconify.design/mdi/linux.svg?color=%23FDB022" alt="Linux" class="w-8 h-8">`,
    mac: `<img src="https://api.iconify.design/mdi/apple.svg?color=%23FDB022" alt="macOS" class="w-8 h-8">`,
    web: `<img src="https://api.iconify.design/mdi/web.svg?color=%23FDB022" alt="Web" class="w-8 h-8">`
  };

  let name = os.charAt(0).toUpperCase() + os.slice(1);
  let icon = icons.web; // Default
  let note = '';

  if (os === 'windows') {
    icon = icons.windows;
    if (fileName.endsWith('.msi')) {
      name = 'Windows (MSI)';
      note = 'MSI installer for managed deployment.';
    } else {
      note = 'Signed installer for Windows x64.';
    }
  } else if (os === 'linux') {
    icon = icons.linux;
    if (fileName.endsWith('.AppImage')) {
      name = 'Linux (AppImage)';
      note = 'Portable: chmod +x and run.';
    } else if (fileName.endsWith('.snap')) {
      name = 'Linux (Snap)';
      note = 'Requires snapd.';
    } else if (fileName.endsWith('.deb')) {
      name = 'Linux (DEB)';
      note = 'For Debian/Ubuntu: sudo dpkg -i file.deb';
    } else if (fileName.endsWith('.rpm')) {
      name = 'Linux (RPM)';
      note = 'For Fedora/RHEL: sudo rpm -i file.rpm';
    }
  } else if (os === 'mac' || os === 'darwin' || os === 'macos') {
    icon = icons.mac;
    if (fileName.includes('arm64')) {
      name = 'macOS (Apple Silicon)';
    } else if (fileName.includes('x64')) {
      name = 'macOS (Intel)';
    } else {
      name = 'macOS';
    }
    if (fileName.endsWith('.app.tar.gz')) {
      note = 'Extract and move to Applications folder.';
    } else {
      note = 'Unsigned: Right-click → Open to bypass security check.';
    }
  } else if (os === 'web') {
    name = 'Web Bundle';
    note = 'Static files for hosting.';
  }

  return { name, icon, note };
}

/**
 * Format file size in MB
 */
export function formatFileSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Truncate a hash string to show only the start and end
 */
export function truncateHash(hash: string, startChars = 8, endChars = 8): string {
  if (hash.length <= startChars + endChars) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

/**
 * Format a release date for display
 */
export function formatReleaseDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Calculate pagination values
 */
export function calculatePagination(
  totalItems: number,
  currentPage: number,
  itemsPerPage: number
): {
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return {
    totalPages,
    startIndex,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
