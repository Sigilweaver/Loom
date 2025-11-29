document.addEventListener('DOMContentLoaded', () => {
    fetchDownloads();
    initializeReleases();
});

const API_URL = 'https://download.sigilweaver.app/latest/downloads.json';
const RELEASES_INDEX_URL = 'https://download.sigilweaver.app/releases/index.json';
const RELEASES_PER_PAGE = 10;

let releasesData = null;
let currentPage = 1;
let expandedReleases = new Set();

async function fetchDownloads() {
    const grid = document.getElementById('downloads-grid');
    const versionDisplay = document.getElementById('latest-version');
    
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
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

        // Render Client Downloads
        if (data.variants.client && data.variants.client.length > 0) {
            renderSection(grid, 'Client Only', 'Connect to an existing Sigilweaver backend.', data.variants.client);
        }

        // Render Web Downloads
        if (data.variants.web && data.variants.web.length > 0) {
            renderSection(grid, 'Web Version', 'Host the UI yourself.', data.variants.web);
        }

        // Update Hero Button based on OS
        updateHeroButton(data);

    } catch (error) {
        console.error('Error fetching downloads:', error);
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-mystic-800/50 rounded-xl border border-red-500/30">
                <p class="text-red-400 mb-2">Failed to load download information.</p>
                <p class="text-mystic-400 text-sm">You can check our <a href="https://github.com/sigilweaver/sigilweaver/releases" class="text-gold-400 hover:underline">GitHub Releases</a> page directly.</p>
            </div>
        `;
    }
}

function renderSection(container, title, description, items) {
    // Section Header
    const header = document.createElement('div');
    header.className = 'col-span-full mt-8 first:mt-0 mb-4';
    header.innerHTML = `
        <h2 class="text-2xl font-bold text-mystic-200">${title}</h2>
        <p class="text-mystic-400">${description}</p>
    `;
    container.appendChild(header);

    // Items
    items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'bg-mystic-700/30 p-6 rounded-xl backdrop-blur-sm border border-mystic-600/50 hover:border-gold-500/30 transition-colors flex flex-col';
        
        const meta = getOsMeta(item.os, item.fileName);
        const sizeMB = (item.size / (1024 * 1024)).toFixed(1);

        card.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3 class="text-xl font-bold text-mystic-200">${meta.name}</h3>
                    <span class="text-xs text-mystic-400 font-mono">${item.arch} • ${item.kind}</span>
                </div>
                <div class="text-gold-400">
                    ${meta.icon}
                </div>
            </div>
            
            <div class="mt-auto">
                <a href="${item.url}" class="block w-full text-center bg-mystic-600 hover:bg-mystic-500 text-white px-4 py-3 rounded-lg transition-colors mb-3 font-medium">
                    Download
                </a>
                <div class="flex justify-between items-center text-xs text-mystic-500 mb-2">
                    <span>${sizeMB} MB</span>
                </div>
                <div class="mb-1">
                    <span class="text-[10px] text-mystic-500 uppercase tracking-wide">SHA256:</span>
                </div>
                <div class="text-[10px] text-mystic-400 font-mono break-all bg-mystic-900/50 p-2 rounded border border-mystic-700/50 select-all" title="SHA256 Hash">
                    ${item.sha256}
                </div>
                ${meta.note ? `<p class="text-xs text-mystic-400 mt-3 border-t border-mystic-700/50 pt-2">${meta.note}</p>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function getOsMeta(os, fileName) {
    const icons = {
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
        note = 'Unsigned build: Click "More info" → "Run anyway" if warned.';
    } else if (os === 'linux') {
        icon = icons.linux;
        if (fileName.endsWith('.AppImage')) {
            name = 'Linux (AppImage)';
            note = 'Portable: chmod +x and run.';
        } else if (fileName.endsWith('.snap')) {
            name = 'Linux (Snap)';
            note = 'Requires snapd.';
        }
    } else if (os === 'mac' || os === 'darwin') {
        icon = icons.mac;
        name = 'macOS';
        note = 'Unsigned: Right-click → Open to bypass security check.';
    } else if (os === 'web') {
        name = 'Web Bundle';
        note = 'Static files for hosting.';
    }

    return { name, icon, note };
}

function updateHeroButton(data) {
    const ua = navigator.userAgent || navigator.platform || '';
    const btn = document.getElementById('auto-download-btn');
    const detected = document.getElementById('detected-os');
    
    if (!btn) return;

    let bestMatch = null;
    let osLabel = 'Linux';

    // Helper to find asset in full variants
    const findAsset = (os, ext) => {
        return data.variants.full?.find(a => a.os === os && a.fileName.endsWith(ext));
    };

    if (/Windows/i.test(ua)) {
        bestMatch = findAsset('windows', '.exe');
        osLabel = 'Windows';
    } else if (/Mac|Macintosh/i.test(ua)) {
        // Assuming we might have mac assets in future, currently none in JSON example
        // Fallback to web or check if mac exists
        bestMatch = data.variants.full?.find(a => a.os === 'mac' || a.os === 'darwin');
        osLabel = 'macOS';
    } else if (/Linux/i.test(ua)) {
        bestMatch = findAsset('linux', '.AppImage');
        osLabel = 'Linux';
    }

    if (bestMatch) {
        btn.href = bestMatch.url;
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
            document.getElementById('downloads-grid').scrollIntoView({ behavior: 'smooth' });
        };
    }
}

// ===== RELEASES SECTION =====

function initializeReleases() {
    const loadButton = document.getElementById('load-releases-btn');
    if (loadButton) {
        loadButton.addEventListener('click', loadReleases);
    }
}

async function loadReleases() {
    const button = document.getElementById('load-releases-btn');
    const container = document.getElementById('releases-container');
    const aboutSection = document.getElementById('releases-about');
    const section = document.getElementById('releases-section');
    
    if (!container) return;
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Loading...';
    
    try {
        const response = await fetch(RELEASES_INDEX_URL);
        if (!response.ok) throw new Error('Failed to fetch releases');
        
        releasesData = await response.json();
        
        // Hide button, show releases section
        button.classList.add('hidden');
        section.classList.remove('hidden');
        aboutSection.classList.remove('hidden');
        container.classList.remove('hidden');
        
        // Render first page
        renderReleasesPage();
        
    } catch (error) {
        console.error('Error loading releases:', error);
        button.disabled = false;
        button.innerHTML = 'Load Previous Releases';
        section.classList.remove('hidden');
        container.innerHTML = `
            <div class="text-center py-8 bg-mystic-800/50 rounded-xl border border-red-500/30">
                <p class="text-red-400">Failed to load releases.</p>
            </div>
        `;
        container.classList.remove('hidden');
    }
}

function renderReleasesPage() {
    const container = document.getElementById('releases-list');
    const pagination = document.getElementById('releases-pagination');
    
    if (!releasesData || !container) return;
    
    const totalReleases = releasesData.releases.length;
    
    if (totalReleases === 0) {
        container.innerHTML = '<div class="text-center py-8 text-mystic-400">No releases available.</div>';
        pagination.innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(totalReleases / RELEASES_PER_PAGE);
    const startIdx = (currentPage - 1) * RELEASES_PER_PAGE;
    const endIdx = Math.min(startIdx + RELEASES_PER_PAGE, totalReleases);
    const pageReleases = releasesData.releases.slice(startIdx, endIdx);
    
    // Render release items
    container.innerHTML = pageReleases.map(release => renderReleaseItem(release)).join('');
    
    // Render pagination
    pagination.innerHTML = renderPagination(currentPage, totalPages);
    
    // Attach event listeners
    attachReleaseEventListeners();
}

function renderReleaseItem(release) {
    const isExpanded = expandedReleases.has(release.version);
    const releaseDate = new Date(release.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
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
                    ${isExpanded ? '<div class="text-center py-4"><div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div></div>' : ''}
                </div>
            </div>
        </div>
    `;
}

function renderPagination(current, total) {
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

function attachReleaseEventListeners() {
    // Toggle buttons
    document.querySelectorAll('.release-toggle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const version = e.target.dataset.version;
            await toggleReleaseDownloads(version);
        });
    });
    
    // Pagination buttons
    document.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = parseInt(e.target.dataset.page);
            if (page) {
                currentPage = page;
                renderReleasesPage();
                document.getElementById('releases-section').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

async function toggleReleaseDownloads(version) {
    const isExpanded = expandedReleases.has(version);
    const container = document.getElementById(`downloads-${version}`);
    const button = document.querySelector(`.release-toggle[data-version="${version}"]`);
    
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
        
        // Load downloads
        try {
            const url = `https://download.sigilweaver.app/releases/${version}/downloads.json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch release downloads');
            
            const data = await response.json();
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

function renderReleaseDownloads(data) {
    let html = '<div class="downloads-loaded space-y-6">';
    
    // Full variant
    if (data.variants.full && data.variants.full.length > 0) {
        html += renderReleaseVariant('Full Application', data.variants.full);
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

function renderReleaseVariant(title, assets) {
    let html = `
        <div class="border-t border-mystic-700/50 pt-4 first:border-0 first:pt-0">
            <h4 class="text-lg font-semibold text-mystic-300 mb-3">${title}</h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
    `;
    
    assets.forEach(asset => {
        const meta = getOsMeta(asset.os, asset.fileName);
        const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);
        
        html += `
            <div class="bg-mystic-900/50 p-4 rounded-lg border border-mystic-700/50">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <div class="text-sm font-semibold text-mystic-200">${meta.name}</div>
                        <div class="text-xs text-mystic-500">${asset.arch} • ${sizeMB} MB</div>
                    </div>
                </div>
                <a href="${asset.url}" class="block text-center bg-mystic-700 hover:bg-mystic-600 text-white px-3 py-2 rounded text-sm transition-colors mb-2">
                    Download
                </a>
                <div class="mb-1">
                    <span class="text-[9px] text-mystic-500 uppercase tracking-wide">SHA256:</span>
                </div>
                <div class="text-[9px] text-mystic-500 font-mono break-all bg-mystic-800/50 p-1.5 rounded border border-mystic-700/30">
                    ${asset.sha256}
                </div>
            </div>
        `;
    });
    
    html += '</div></div>';
    return html;
}
