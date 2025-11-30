/**
 * Downloads page entry point
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeAccessibility } from '@lib/accessibility';
import { initializeNavigation } from '@lib/navigation';
import { initializeNodeConnections } from '@lib/node-connections';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Initialize layout with shared components
  initializeLayout();
  
  // Initialize core functionality
  initializeAccessibility();
  initializeNavigation();
  initializeNodeConnections();
  
  // Initialize downloads-specific functionality
  initializeDownloads();
});

/**
 * Downloads page specific functionality
 */
function initializeDownloads(): void {
  detectOS();
  loadLatestRelease();
  
  const loadReleasesBtn = document.getElementById('load-releases-btn');
  if (loadReleasesBtn) {
    loadReleasesBtn.addEventListener('click', loadPreviousReleases);
  }
}

/**
 * Detect user's operating system
 */
function detectOS(): void {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  
  let os = 'Unknown';
  let downloadUrl = 'http://download.sigilweaver.app/latest/sigilweaver.appimage';
  let buttonText = 'Download for Linux';
  
  if (platform.includes('win') || userAgent.includes('windows')) {
    os = 'Windows';
    downloadUrl = 'http://download.sigilweaver.app/latest/sigilweaver.exe';
    buttonText = 'Download for Windows';
  } else if (platform.includes('mac') || userAgent.includes('macintosh')) {
    os = 'macOS';
    downloadUrl = 'http://download.sigilweaver.app/latest/sigilweaver.dmg';
    buttonText = 'Download for macOS';
  } else if (platform.includes('linux') || userAgent.includes('linux')) {
    os = 'Linux';
    downloadUrl = 'http://download.sigilweaver.app/latest/sigilweaver.appimage';
    buttonText = 'Download for Linux';
  }
  
  const detectedOsEl = document.getElementById('detected-os');
  const autoDownloadBtn = document.getElementById('auto-download-btn') as HTMLAnchorElement;
  
  if (detectedOsEl) {
    detectedOsEl.textContent = `Detected: ${os}`;
  }
  
  if (autoDownloadBtn) {
    autoDownloadBtn.href = downloadUrl;
    autoDownloadBtn.textContent = buttonText;
  }
}

/**
 * Load latest release information from GitHub
 */
async function loadLatestRelease(): Promise<void> {
  const grid = document.getElementById('downloads-grid');
  if (!grid) return;
  
  try {
    const response = await fetch('https://api.github.com/repos/sigilweaver/sigilweaver/releases/latest');
    
    if (!response.ok) {
      throw new Error('Failed to fetch release info');
    }
    
    const release = await response.json();
    renderReleaseCards(release, grid);
    
    // Update version display
    const versionEl = document.getElementById('latest-version');
    if (versionEl) {
      versionEl.textContent = `Latest Release: ${release.tag_name}`;
      versionEl.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading release:', error);
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-mystic-300">Unable to load release information.</p>
        <p class="text-mystic-400 mt-2">Please check <a href="https://github.com/sigilweaver/sigilweaver/releases" class="text-gold-400 hover:underline">GitHub Releases</a> directly.</p>
      </div>
    `;
  }
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
}

/**
 * Render release download cards
 */
function renderReleaseCards(release: GitHubRelease, container: HTMLElement): void {
  const platforms = [
    { 
      name: 'Windows', 
      icon: '🪟', 
      extensions: ['.exe'], 
      description: 'Windows 10/11 (64-bit)' 
    },
    { 
      name: 'macOS', 
      icon: '🍎', 
      extensions: ['.dmg', '.zip'], 
      description: 'macOS 11+ (Intel & Apple Silicon)' 
    },
    { 
      name: 'Linux (AppImage)', 
      icon: '🐧', 
      extensions: ['.appimage', '.AppImage'], 
      description: 'Universal Linux (portable)' 
    },
    { 
      name: 'Linux (Snap)', 
      icon: '📦', 
      extensions: ['.snap'], 
      description: 'Snap-enabled distributions' 
    },
    { 
      name: 'Web (Self-Host)', 
      icon: '🌐', 
      extensions: ['-web.zip', 'web.zip'], 
      description: 'Static files for deployment' 
    },
  ];
  
  let html = '';
  
  for (const platform of platforms) {
    const asset = release.assets.find((a: GitHubAsset) => 
      platform.extensions.some(ext => a.name.toLowerCase().endsWith(ext.toLowerCase()))
    );
    
    if (asset) {
      const sizeInMB = (asset.size / (1024 * 1024)).toFixed(1);
      html += `
        <div class="bg-mystic-700/30 p-6 rounded-xl backdrop-blur-sm border border-mystic-600/50 hover:border-gold-400/50 transition-all">
          <div class="text-4xl mb-4">${platform.icon}</div>
          <h3 class="text-xl font-bold text-mystic-200 mb-2">${platform.name}</h3>
          <p class="text-mystic-400 text-sm mb-4">${platform.description}</p>
          <a href="${asset.browser_download_url}" 
             class="block bg-gradient-to-r from-mystic-600 to-mystic-500 hover:from-mystic-500 hover:to-mystic-400 px-4 py-3 rounded-lg text-center font-medium transition-all">
            Download (${sizeInMB} MB)
          </a>
        </div>
      `;
    }
  }
  
  if (!html) {
    html = `
      <div class="col-span-full text-center py-12">
        <p class="text-mystic-300">No downloads available yet.</p>
        <p class="text-mystic-400 mt-2">Check back soon!</p>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Load previous releases
 */
async function loadPreviousReleases(): Promise<void> {
  const section = document.getElementById('releases-section');
  const aboutSection = document.getElementById('releases-about');
  const container = document.getElementById('releases-container');
  const list = document.getElementById('releases-list');
  const btn = document.getElementById('load-releases-btn');
  
  if (!section || !container || !list || !btn) return;
  
  btn.textContent = 'Loading...';
  btn.setAttribute('disabled', 'true');
  
  try {
    const response = await fetch('https://api.github.com/repos/sigilweaver/sigilweaver/releases');
    
    if (!response.ok) {
      throw new Error('Failed to fetch releases');
    }
    
    const releases: GitHubRelease[] = await response.json();
    
    section.classList.remove('hidden');
    aboutSection?.classList.remove('hidden');
    container.classList.remove('hidden');
    btn.classList.add('hidden');
    
    let html = '';
    for (const release of releases) {
      const date = new Date(release.published_at).toLocaleDateString();
      html += `
        <details class="bg-mystic-800/50 rounded-lg border border-mystic-600/50 overflow-hidden">
          <summary class="px-6 py-4 cursor-pointer hover:bg-mystic-700/30 transition-colors">
            <span class="font-semibold text-mystic-200">${release.tag_name}</span>
            <span class="text-mystic-400 ml-2">${release.name}</span>
            <span class="text-mystic-500 text-sm ml-2">${date}</span>
          </summary>
          <div class="px-6 pb-4 border-t border-mystic-700">
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              ${release.assets.map((asset: GitHubAsset) => `
                <a href="${asset.browser_download_url}" 
                   class="flex items-center justify-between bg-mystic-700/50 px-4 py-2 rounded hover:bg-mystic-600/50 transition-colors text-sm">
                  <span class="text-mystic-300 truncate">${asset.name}</span>
                  <span class="text-mystic-500 ml-2">${(asset.size / (1024 * 1024)).toFixed(1)} MB</span>
                </a>
              `).join('')}
            </div>
          </div>
        </details>
      `;
    }
    
    list.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading releases:', error);
    btn.textContent = 'Failed to load. Try again.';
    btn.removeAttribute('disabled');
  }
}
