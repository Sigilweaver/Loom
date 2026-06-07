/**
 * Downloads API Client
 * Functions for fetching release data
 */

import type { DownloadsData, ReleaseInfo, ReleasesIndex } from './types';

const RELEASES_INDEX_URL = 'https://download.sigilweaver.app/releases/loom/index.json';

/**
 * Parse a version string into a numeric tuple for correct semver sorting.
 * Strips leading 'v', splits on '.', and appends a pre-release flag
 * (0 for pre-release, 1 for stable) so that e.g. v0.10.2-alpha < v0.10.2.
 */
function versionSortKey(version: string): number[] {
  let v = version.replace(/^v/i, '');
  let preRelease = 1;
  const dashIdx = v.indexOf('-');
  if (dashIdx !== -1) {
    v = v.slice(0, dashIdx);
    preRelease = 0;
  }
  const parts = v.split('.').map(Number);
  parts.push(preRelease);
  return parts;
}

/**
 * Compare two releases by version, newest first.
 */
function compareReleases(a: ReleaseInfo, b: ReleaseInfo): number {
  const ka = versionSortKey(a.version);
  const kb = versionSortKey(b.version);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const diff = (kb[i] ?? 0) - (ka[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Build the URL for a version's downloads.json
 */
export function buildDownloadsUrl(version: string): string {
  return `https://download.sigilweaver.app/releases/loom/${version}/downloads.json`;
}

/**
 * Fetch the releases index, sorting releases by semver (newest first).
 */
export async function fetchReleasesIndex(): Promise<ReleasesIndex> {
  const response = await fetch(RELEASES_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch releases index: ${response.status}`);
  }
  const index: ReleasesIndex = await response.json();
  index.releases.sort(compareReleases);
  return index;
}

/**
 * Fetch downloads data for a specific version
 */
export async function fetchDownloadsData(version: string): Promise<DownloadsData> {
  const url = buildDownloadsUrl(version);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch downloads for ${version}: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch the latest release downloads
 */
export async function fetchLatestDownloads(): Promise<{
  data: DownloadsData;
  releasesIndex: ReleasesIndex;
}> {
  const releasesIndex = await fetchReleasesIndex();
  
  if (!releasesIndex.releases || releasesIndex.releases.length === 0) {
    throw new Error('No releases available');
  }
  
  const latestVersion = releasesIndex.releases[0].version;
  const data = await fetchDownloadsData(latestVersion);
  
  return { data, releasesIndex };
}
