/**
 * Downloads page entry point
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeNavigation } from '@lib/navigation';
import {
  type DownloadAsset,
  type DownloadsData,
  type ReleasesIndex,
  type ReleaseInfo,
  fetchLatestDownloads,
  fetchDownloadsData,
  fetchReleasesIndex,
  detectOS,
  getOSLabel,
  findAssetForOS,
  getOsMeta,
  truncateHash,
  formatReleaseDate,
} from '@lib/downloads';

const RELEASES_PER_PAGE = 10;

// State for releases pagination
let releasesData: ReleasesIndex | null = null;
let currentPage = 1;
let expandedReleases = new Set<string>();

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Initialize layout with shared components
  initializeLayout();
  
  // Initialize navigation
  initializeNavigation();
  
  // Initialize downloads-specific functionality
  initializeDownloads();
});

/**
 * Downloads page specific functionality
 */
function initializeDownloads(): void {
  fetchDownloadsPage();
  
  const loadReleasesBtn = document.getElementById('load-releases-btn');
  if (loadReleasesBtn) {
    loadReleasesBtn.addEventListener('click', loadReleases);
  }
}

/**
 * Fetch and display the latest downloads
 */
async function fetchDownloadsPage(): Promise<void> {
  const grid = document.getElementById('downloads-grid');
  const versionDisplay = document.getElementById('latest-version');
  
  if (!grid) return;
  
  try {
    const { data, releasesIndex } = await fetchLatestDownloads();
    releasesData = releasesIndex;
    
    // Update version display
    if (versionDisplay) {
      versionDisplay.textContent = `Latest Release: ${data.version}`;
      versionDisplay.classList.remove('hidden');
    }

    // Clear loading state
    grid.innerHTML = '';

    // Render Full Downloads (Primary)
    if (data.variants.full && data.variants.full.length > 0) {
      renderSection(grid, 'Full Application (Recommended)', 'Includes everything you need to run Sigilweaver locally.', data.variants.full);
    }

    // Render Tauri Downloads (Lightweight Native)
    if (data.variants.tauri && data.variants.tauri.length > 0) {
      renderSection(grid, 'Lightweight Native (Tauri)', 'Native desktop app with smaller footprint. Requires separate backend server.', data.variants.tauri);
    }

    // Render Client Downloads
    if (data.variants.client && data.variants.client.length > 0) {
      renderSection(grid, 'Client Only', 'Connect to an existing Sigilweaver backend.', data.variants.client);
    }

    // Render Other Section (Server + Web)
    renderOtherSection(grid, data.variants.web);

    // Update Hero Button based on OS
    updateHeroButton(data);
    
    // Initialize copy buttons
    setupCopyButtons();

  } catch (error) {
    console.error('Error fetching downloads:', error);
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 bg-mystic-800/50 rounded-xl border border-red-500/30">
        <p class="text-red-400 mb-2">Failed to load download information.</p>
        <button id="retry-downloads-btn" class="text-sm bg-mystic-700 hover:bg-mystic-600 text-white px-4 py-2 rounded-lg transition-colors mb-4 inline-flex items-center space-x-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          <span>Retry</span>
        </button>
        <p class="text-mystic-400 text-sm">Or check our <a href="https://github.com/sigilweaver/sigilweaver/releases" class="text-gold-400 hover:underline">GitHub Releases</a> page directly.</p>
      </div>
    `;
    document.getElementById('retry-downloads-btn')?.addEventListener('click', () => fetchDownloadsPage());
  }
}

/**
 * Render the Other Options section (Server + Web)
 */
function renderOtherSection(container: HTMLElement, webVariants?: DownloadAsset[]): void {
  // Section Header
  const header = document.createElement('div');
  header.className = 'mt-8 mb-4 col-span-full first:mt-0';
  header.innerHTML = `
    <h2 class="text-2xl font-bold text-mystic-200">Other Options</h2>
    <p class="text-mystic-400">Server deployment and self-hosted web components.</p>
  `;
  container.appendChild(header);

  // --- Server Card ---
  const serverCard = document.createElement('article');
  serverCard.className = 'flex flex-col p-6 transition-colors border bg-mystic-700/30 rounded-xl backdrop-blur-sm border-mystic-600/50 hover:border-gold-500/30';
  
  serverCard.innerHTML = `
      <div class="flex items-start justify-between mb-6">
        <div>
          <h3 class="text-xl font-bold text-mystic-200">Server</h3>
          <div class="text-xs text-mystic-400 font-mono mt-1 flex items-center gap-2">
            <span>Universal</span>
            <span class="w-1 h-1 rounded-full bg-mystic-600"></span>
            <span>Guide</span>
          </div>
        </div>
        <div class="text-gold-400 p-2 bg-mystic-800/50 rounded-lg border border-mystic-700/30">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
        </div>
      </div>
      
      <div>
        <a href="/docs/admin/deployment" class="block w-full text-center bg-mystic-600 hover:bg-mystic-500 text-white px-4 py-3 rounded-lg transition-all hover:shadow-lg hover:shadow-mystic-900/20 hover:-translate-y-0.5 mb-4 font-medium group">
          <span class="flex items-center justify-center gap-2">
            View Documentation
            <svg class="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          </span>
        </a>
        
        <p class="text-xs text-mystic-400 mt-3 text-center opacity-80 border-t border-mystic-700/30 pt-3">
          Learn how to deploy via Docker, Kubernetes, or bare metal.
        </p>
      </div>
  `;
  container.appendChild(serverCard);

  // --- Web Variants ---
  if (webVariants && webVariants.length > 0) {
    webVariants.forEach(item => {
      const card = document.createElement('article');
      card.className = 'flex flex-col p-6 transition-colors border bg-mystic-700/30 rounded-xl backdrop-blur-sm border-mystic-600/50 hover:border-gold-500/30';
      
      const meta = getOsMeta(item.os, item.fileName);
      const sizeMB = (item.size / (1024 * 1024)).toFixed(1);

      card.innerHTML = `
        <div class="flex items-start justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-mystic-200">${meta.name}</h3>
            <div class="text-xs text-mystic-400 font-mono mt-1 flex items-center gap-2">
              <span>${item.arch}</span>
              <span class="w-1 h-1 rounded-full bg-mystic-600"></span>
              <span>${item.kind}</span>
              <span class="w-1 h-1 rounded-full bg-mystic-600"></span>
              <span>${sizeMB} MB</span>
            </div>
          </div>
          <div class="text-gold-400 p-2 bg-mystic-800/50 rounded-lg border border-mystic-700/30">
            ${meta.icon}
          </div>
        </div>
        
        <div>
          <a href="${item.url}" download="${item.fileName}" class="block w-full text-center bg-mystic-600 hover:bg-mystic-500 text-white px-4 py-3 rounded-lg transition-all hover:shadow-lg hover:shadow-mystic-900/20 hover:-translate-y-0.5 mb-4 font-medium group">
            <span class="flex items-center justify-center gap-2">
              Download
              <svg class="w-4 h-4 opacity-70 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            </span>
          </a>
          
          <div class="flex items-center justify-between gap-3 text-xs text-mystic-500 bg-mystic-900/30 rounded px-3 py-2 border border-mystic-700/30">
            <span class="uppercase tracking-wider text-[10px] font-semibold opacity-60">SHA256</span>
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-mono truncate select-all" title="${item.sha256}">${truncateHash(item.sha256)}</span>
              <button class="text-mystic-400 hover:text-gold-400 transition-colors focus:outline-none copy-btn relative p-1 -mr-1 rounded hover:bg-mystic-800/50" data-hash="${item.sha256}" aria-label="Copy SHA256 hash">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span class="copy-tooltip">Copied!</span>
              </button>
            </div>
          </div>

          ${meta.note ? `<p class="text-xs text-mystic-400 mt-3 text-center opacity-80 border-t border-mystic-700/30 pt-3">${meta.note}</p>` : ''}
        </div>
      `;
      container.appendChild(card);
    });
  }
}

/**
 * Render a section of downloads
 */
function renderSection(container: HTMLElement, title: string, description: string, items: DownloadAsset[]): void {
  // Section Header
  const header = document.createElement('div');
  header.className = 'mt-8 mb-4 col-span-full first:mt-0';
  header.innerHTML = `
    <h2 class="text-2xl font-bold text-mystic-200">${title}</h2>
    <p class="text-mystic-400">${description}</p>
  `;
  container.appendChild(header);

  // Items
  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'flex flex-col p-6 transition-colors border bg-mystic-700/30 rounded-xl backdrop-blur-sm border-mystic-600/50 hover:border-gold-500/30';
    
    const meta = getOsMeta(item.os, item.fileName);
    const sizeMB = (item.size / (1024 * 1024)).toFixed(1);

    card.innerHTML = `
      <div class="flex items-start justify-between mb-6">
        <div>
          <h3 class="text-xl font-bold text-mystic-200">${meta.name}</h3>
          <div class="text-xs text-mystic-400 font-mono mt-1 flex items-center gap-2">
            <span>${item.arch}</span>
            <span class="w-1 h-1 rounded-full bg-mystic-600"></span>
            <span>${item.kind}</span>
            <span class="w-1 h-1 rounded-full bg-mystic-600"></span>
            <span>${sizeMB} MB</span>
          </div>
        </div>
        <div class="text-gold-400 p-2 bg-mystic-800/50 rounded-lg border border-mystic-700/30">
          ${meta.icon}
        </div>
      </div>
      
      <div>
        <a href="${item.url}" download="${item.fileName}" class="block w-full text-center bg-mystic-600 hover:bg-mystic-500 text-white px-4 py-3 rounded-lg transition-all hover:shadow-lg hover:shadow-mystic-900/20 hover:-translate-y-0.5 mb-4 font-medium group">
          <span class="flex items-center justify-center gap-2">
            Download
            <svg class="w-4 h-4 opacity-70 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </span>
        </a>
        
        <div class="flex items-center justify-between gap-3 text-xs text-mystic-500 bg-mystic-900/30 rounded px-3 py-2 border border-mystic-700/30">
          <span class="uppercase tracking-wider text-[10px] font-semibold opacity-60">SHA256</span>
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-mono truncate select-all" title="${item.sha256}">${truncateHash(item.sha256)}</span>
            <button class="text-mystic-400 hover:text-gold-400 transition-colors focus:outline-none copy-btn relative p-1 -mr-1 rounded hover:bg-mystic-800/50" data-hash="${item.sha256}" aria-label="Copy SHA256 hash">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span class="copy-tooltip">Copied!</span>
            </button>
          </div>
        </div>

        ${meta.note ? `<p class="text-xs text-mystic-400 mt-3 text-center opacity-80 border-t border-mystic-700/30 pt-3">${meta.note}</p>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Update the hero button based on detected OS
 */
function updateHeroButton(data: DownloadsData): void {
  const ua = navigator.userAgent || navigator.platform || '';
  const btn = document.getElementById('auto-download-btn') as HTMLAnchorElement | null;
  const detected = document.getElementById('detected-os');

  if (!btn) return;

  const os = detectOS(ua);
  const osLabel = getOSLabel(os);
  const bestMatch = findAssetForOS(data, os);

  if (bestMatch) {
    btn.href = bestMatch.url;
    btn.setAttribute('download', bestMatch.fileName);
    btn.innerHTML = `Download for ${osLabel} <span class="block text-sm opacity-75 font-normal">${data.version}</span>`;
    if (detected) detected.textContent = `Detected ${osLabel}. Clicking will download ${bestMatch.fileName}`;
  } else {
    // Fallback if no OS match or no asset for OS
    btn.href = '#downloads-grid';
    btn.textContent = 'Select Your Platform';
    if (detected) detected.textContent = 'Could not detect OS or no build available.';
    
    // Smooth scroll to grid
    btn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('downloads-grid')?.scrollIntoView({ behavior: 'smooth' });
    };
  }
}

/**
 * Load previous releases from the releases index
 * Reuses releasesData if already fetched by fetchDownloadsPage()
 */
async function loadReleases(): Promise<void> {
  const button = document.getElementById('load-releases-btn') as HTMLButtonElement | null;
  const container = document.getElementById('releases-container');
  const aboutSection = document.getElementById('releases-about');
  const section = document.getElementById('releases-section');
  
  if (!container || !button) return;
  
  // Show loading state
  button.disabled = true;
  button.innerHTML = '<span class="inline-block mr-2">⏳</span> Loading...';
  
  try {
    // Reuse releasesData if already fetched, otherwise fetch it
    if (!releasesData) {
      releasesData = await fetchReleasesIndex();
    }
    
    // Hide button, show releases section
    button.classList.add('hidden');
    section?.classList.remove('hidden');
    aboutSection?.classList.remove('hidden');
    container.classList.remove('hidden');
    
    // Render first page
    renderReleasesPage();
    
  } catch (error) {
    console.error('Error loading releases:', error);
    button.disabled = false;
    button.innerHTML = 'Load Previous Releases';
    section?.classList.remove('hidden');
    container.innerHTML = `
      <div class="text-center py-8 bg-mystic-800/50 rounded-xl border border-red-500/30">
        <p class="text-red-400">Failed to load releases.</p>
      </div>
    `;
    container.classList.remove('hidden');
  }
}

/**
 * Render a page of releases
 */
function renderReleasesPage(): void {
  const container = document.getElementById('releases-list');
  const pagination = document.getElementById('releases-pagination');
  
  if (!releasesData || !container) return;
  
  const totalReleases = releasesData.releases.length;
  
  if (totalReleases === 0) {
    container.innerHTML = '<div class="text-center py-8 text-mystic-400">No releases available.</div>';
    if (pagination) pagination.innerHTML = '';
    return;
  }
  
  const totalPages = Math.ceil(totalReleases / RELEASES_PER_PAGE);
  const startIdx = (currentPage - 1) * RELEASES_PER_PAGE;
  const endIdx = Math.min(startIdx + RELEASES_PER_PAGE, totalReleases);
  const pageReleases = releasesData.releases.slice(startIdx, endIdx);
  
  // Render release items
  container.innerHTML = pageReleases.map(release => renderReleaseItem(release)).join('');
  
  // Render pagination
  if (pagination) {
    pagination.innerHTML = renderPagination(currentPage, totalPages);
  }
  
  // Attach event listeners
  attachReleaseEventListeners();
}

/**
 * Render a single release item
 */
function renderReleaseItem(release: ReleaseInfo): string {
  const isExpanded = expandedReleases.has(release.version);
  const releaseDate = formatReleaseDate(release.date);
  
  return `
    <div class="bg-mystic-800/50 rounded-xl border border-mystic-600/50 overflow-hidden" data-release="${release.version}">
      <div class="p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-2xl font-bold text-mystic-200">${release.version}</h3>
            <p class="text-mystic-400 text-sm">${releaseDate}</p>
          </div>
          <button 
            class="release-toggle bg-mystic-700 hover:bg-mystic-600 px-4 py-2 rounded-lg transition-colors text-sm"
            data-version="${release.version}"
          >
            ${isExpanded ? 'Hide Downloads' : 'Show Downloads'}
          </button>
        </div>
        
        <div class="release-downloads ${isExpanded ? '' : 'hidden'}" id="downloads-${release.version}">
          ${isExpanded ? '<div class="text-center py-4"><div class="inline-block rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div></div>' : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render pagination controls
 */
function renderPagination(current: number, total: number): string {
  let html = '<div class="flex items-center justify-center gap-2 mt-8">';
  
  // Always show page indicator
  html += `<span class="text-mystic-400 text-sm">Page ${current} of ${total}</span>`;
  
  if (total <= 1) {
    html += '</div>';
    return html;
  }
  
  html += '<span class="text-mystic-600 mx-2">•</span>';
  
  // Previous button
  if (current > 1) {
    html += `<button class="pagination-btn bg-mystic-700 hover:bg-mystic-600 px-4 py-2 rounded-lg transition-colors" data-page="${current - 1}">Previous</button>`;
  }
  
  // Page numbers
  const maxButtons = 7;
  let startPage = Math.max(1, current - Math.floor(maxButtons / 2));
  let endPage = Math.min(total, startPage + maxButtons - 1);
  
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  
  if (startPage > 1) {
    html += `<button class="pagination-btn bg-mystic-700 hover:bg-mystic-600 px-3 py-2 rounded-lg transition-colors" data-page="1">1</button>`;
    if (startPage > 2) html += '<span class="text-mystic-500 px-2">...</span>';
  }
  
  for (let i = startPage; i <= endPage; i++) {
    if (i === current) {
      html += `<button class="pagination-btn bg-gold-500 text-mystic-900 font-bold px-3 py-2 rounded-lg" disabled>${i}</button>`;
    } else {
      html += `<button class="pagination-btn bg-mystic-700 hover:bg-mystic-600 px-3 py-2 rounded-lg transition-colors" data-page="${i}">${i}</button>`;
    }
  }
  
  if (endPage < total) {
    if (endPage < total - 1) html += '<span class="text-mystic-500 px-2">...</span>';
    html += `<button class="pagination-btn bg-mystic-700 hover:bg-mystic-600 px-3 py-2 rounded-lg transition-colors" data-page="${total}">${total}</button>`;
  }
  
  // Next button
  if (current < total) {
    html += `<button class="pagination-btn bg-mystic-700 hover:bg-mystic-600 px-4 py-2 rounded-lg transition-colors" data-page="${current + 1}">Next</button>`;
  }
  
  html += '</div>';
  return html;
}

/**
 * Attach event listeners to release toggles and pagination
 */
function attachReleaseEventListeners(): void {
  // Toggle buttons
  document.querySelectorAll('.release-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLButtonElement;
      const version = target.dataset.version;
      if (version) {
        await toggleReleaseDownloads(version);
      }
    });
  });
  
  // Pagination buttons
  document.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const page = parseInt(target.dataset.page || '0');
      if (page) {
        currentPage = page;
        renderReleasesPage();
        document.getElementById('releases-section')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Toggle the downloads display for a specific release
 */
async function toggleReleaseDownloads(version: string): Promise<void> {
  const isExpanded = expandedReleases.has(version);
  const container = document.getElementById(`downloads-${version}`);
  const button = document.querySelector(`.release-toggle[data-version="${version}"]`) as HTMLButtonElement | null;
  
  if (!container || !button) return;
  
  if (isExpanded) {
    // Collapse
    expandedReleases.delete(version);
    container.classList.add('hidden');
    button.textContent = 'Show Downloads';
  } else {
    // Expand and load if not already loaded
    expandedReleases.add(version);
    container.classList.remove('hidden');
    button.textContent = 'Hide Downloads';
    
    // Check if already loaded
    if (container.querySelector('.downloads-loaded')) return;
    
    // Show loading state
    container.innerHTML = '<div class="text-center py-4"><div class="inline-block rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div></div>';
    
    // Load downloads
    try {
      const data = await fetchDownloadsData(version);
      container.innerHTML = renderReleaseDownloads(data);
      
    } catch (error) {
      console.error(`Error loading downloads for ${version}:`, error);
      container.innerHTML = `
        <div class="text-center py-4 text-red-400">
          Failed to load downloads for this release.
        </div>
      `;
    }
  }
}

/**
 * Render the downloads for a specific release
 */
function renderReleaseDownloads(data: DownloadsData): string {
  let html = '<div class="downloads-loaded space-y-6">';
  
  // Full variant
  if (data.variants.full && data.variants.full.length > 0) {
    html += renderReleaseVariant('Full Application', data.variants.full);
  }
  
  // Tauri variant
  if (data.variants.tauri && data.variants.tauri.length > 0) {
    html += renderReleaseVariant('Lightweight Native (Tauri)', data.variants.tauri);
  }
  
  // Client variant
  if (data.variants.client && data.variants.client.length > 0) {
    html += renderReleaseVariant('Client Only', data.variants.client);
  }
  
  // Web variant
  if (data.variants.web && data.variants.web.length > 0) {
    html += renderReleaseVariant('Web Version', data.variants.web);
  }
  
  html += '</div>';
  return html;
}

/**
 * Render a variant section within a release
 */
function renderReleaseVariant(title: string, assets: DownloadAsset[]): string {
  let html = `
    <div class="border-t border-mystic-700/50 pt-4 first:border-0 first:pt-0">
      <h4 class="text-lg font-semibold text-mystic-300 mb-3">${title}</h4>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
  `;
  
  assets.forEach(asset => {
    const meta = getOsMeta(asset.os, asset.fileName);
    const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);
    
    html += `
      <div class="bg-mystic-900/50 p-4 rounded-lg border border-mystic-700/50 flex flex-col">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="text-sm font-semibold text-mystic-200">${meta.name}</div>
            <div class="text-xs text-mystic-500 mt-0.5">${asset.arch} • ${sizeMB} MB</div>
          </div>
        </div>
        
        <a href="${asset.url}" download="${asset.fileName}" class="block text-center bg-mystic-700 hover:bg-mystic-600 text-white px-3 py-2 rounded text-sm transition-colors mb-3 font-medium">
          Download
        </a>
        
        <div class="mt-auto flex items-center justify-between gap-2 text-[10px] text-mystic-500 bg-mystic-800/30 rounded px-2 py-1.5 border border-mystic-700/30">
          <span class="uppercase tracking-wider font-semibold opacity-60">SHA</span>
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-mono truncate select-all" title="${asset.sha256}">${truncateHash(asset.sha256, 6, 6)}</span>
            <button class="text-mystic-400 hover:text-gold-400 transition-colors focus:outline-none copy-btn relative p-0.5 -mr-0.5 rounded hover:bg-mystic-700/50" data-hash="${asset.sha256}" aria-label="Copy SHA256 hash">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span class="copy-tooltip">Copied!</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div></div>';
  return html;
}

/**
 * Initialize copy buttons for SHA256 hashes
 */
function setupCopyButtons(): void {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const hash = button.dataset.hash;
      const tooltip = button.querySelector('.copy-tooltip');
      
      if (hash) {
        try {
          await navigator.clipboard.writeText(hash);
          
          // Show tooltip
          tooltip?.classList.add('show');
          
          // Hide after 2 seconds
          setTimeout(() => {
            tooltip?.classList.remove('show');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy hash:', err);
        }
      }
    });
  });
}
