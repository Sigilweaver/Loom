/**
 * Downloads API Client
 * Functions for fetching release data
 */

import type { DownloadsData, ReleasesIndex } from './types';

const RELEASES_INDEX_URL = 'https://download.sigilweaver.app/releases/index.json';

/**
 * Build the URL for a version's downloads.json
 */
export function buildDownloadsUrl(version: string): string {
  return `https://download.sigilweaver.app/releases/${version}/downloads.json`;
}

/**
 * Fetch the releases index
 */
export async function fetchReleasesIndex(): Promise<ReleasesIndex> {
  const response = await fetch(RELEASES_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch releases index: ${response.status}`);
  }
  return response.json();
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
