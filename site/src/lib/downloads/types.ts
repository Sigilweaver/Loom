/**
 * Downloads API Types
 * Type definitions for the downloads API
 */

export interface DownloadAsset {
  os: string;
  arch: string;
  kind: string;
  fileName: string;
  url: string;
  size: number;
  sha256: string;
}

export interface DownloadsData {
  version: string;
  variants: {
    full?: DownloadAsset[];
    client?: DownloadAsset[];
    tauri?: DownloadAsset[];
    web?: DownloadAsset[];
  };
}

export interface ReleaseInfo {
  version: string;
  date: string;
}

export interface ReleasesIndex {
  releases: ReleaseInfo[];
}

export interface OsMeta {
  name: string;
  icon: string;
  note: string;
}
