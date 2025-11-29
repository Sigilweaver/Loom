// Platform detection and reordering for verify-downloads page
document.addEventListener('DOMContentLoaded', () => {
    detectAndReorderPlatforms();
});

function detectAndReorderPlatforms() {
    const ua = navigator.userAgent || navigator.platform || '';
    const sectionsContainer = document.getElementById('platform-sections');
    
    if (!sectionsContainer) return;
    
    const windowsSection = document.getElementById('platform-windows');
    const macosSection = document.getElementById('platform-macos');
    const linuxSection = document.getElementById('platform-linux');
    
    if (!windowsSection || !macosSection || !linuxSection) return;
    
    let detectedPlatform = 'linux'; // default
    
    if (/Windows/i.test(ua)) {
        detectedPlatform = 'windows';
    } else if (/Mac|Macintosh/i.test(ua)) {
        detectedPlatform = 'macos';
    } else if (/Linux/i.test(ua)) {
        detectedPlatform = 'linux';
    }
    
    // Reorder sections based on detected platform
    const sections = [windowsSection, macosSection, linuxSection];
    const platformMap = {
        'windows': windowsSection,
        'macos': macosSection,
        'linux': linuxSection
    };
    
    // Clear container
    sectionsContainer.innerHTML = '';
    
    // Add detected platform first with highlight
    const primarySection = platformMap[detectedPlatform];
    primarySection.classList.add('ring-2', 'ring-gold-500/50');
    const badge = document.createElement('div');
    badge.className = 'absolute top-4 right-4 bg-gold-500 text-mystic-900 text-xs font-bold px-3 py-1 rounded-full';
    badge.textContent = 'Detected Platform';
    primarySection.style.position = 'relative';
    primarySection.insertBefore(badge, primarySection.firstChild);
    
    sectionsContainer.appendChild(primarySection);
    
    // Add other sections
    sections.forEach(section => {
        if (section !== primarySection) {
            sectionsContainer.appendChild(section);
        }
    });
}
