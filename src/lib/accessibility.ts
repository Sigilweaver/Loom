/**
 * Accessibility Mode
 * Single toggle that enables reduced motion + high contrast
 */

const A11Y_PREF_KEY = 'sigilweaver-a11y';
const A11Y_CLASS = 'a11y';

/**
 * Initialize accessibility mode
 */
export function initializeAccessibility(): void {
  // Check saved preference
  const saved = localStorage.getItem(A11Y_PREF_KEY);
  
  // Check system preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
  
  // Enable if: saved as true, OR (no saved pref AND system prefers it)
  const enabled = saved !== null 
    ? saved === 'true' 
    : (prefersReducedMotion || prefersHighContrast);
  
  // Apply
  setAccessibilityMode(enabled, false);
  
  // Attach click handlers
  document.querySelectorAll('[data-toggle="accessibility"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleAccessibilityMode();
    });
  });
  
  // Listen for system preference changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', handleSystemChange);
  window.matchMedia('(prefers-contrast: more)').addEventListener('change', handleSystemChange);
}

function handleSystemChange(): void {
  // Only auto-update if user hasn't set a manual preference
  if (localStorage.getItem(A11Y_PREF_KEY) === null) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
    setAccessibilityMode(prefersReducedMotion || prefersHighContrast, false);
  }
}

/**
 * Set accessibility mode on/off
 */
export function setAccessibilityMode(enabled: boolean, save = true): void {
  if (enabled) {
    document.documentElement.classList.add(A11Y_CLASS);
  } else {
    document.documentElement.classList.remove(A11Y_CLASS);
  }
  
  if (save) {
    localStorage.setItem(A11Y_PREF_KEY, String(enabled));
  }
  
  updateToggleUI(enabled);
}

/**
 * Toggle accessibility mode
 */
export function toggleAccessibilityMode(): void {
  const enabled = document.documentElement.classList.contains(A11Y_CLASS);
  const newState = !enabled;
  setAccessibilityMode(newState, true);
  showFeedback(newState);
}

/**
 * Update all toggle buttons UI
 */
function updateToggleUI(enabled: boolean): void {
  document.querySelectorAll('[data-toggle="accessibility"]').forEach((el) => {
    const btn = el as HTMLElement;
    btn.setAttribute('aria-pressed', String(enabled));
    btn.title = enabled ? 'Disable accessibility mode' : 'Enable accessibility mode';
    if (enabled) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Show feedback toast
 */
function showFeedback(enabled: boolean): void {
  // Remove existing
  document.querySelectorAll('.a11y-feedback').forEach(el => el.remove());
  
  const toast = document.createElement('div');
  toast.className = 'a11y-feedback fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50';
  toast.style.cssText = enabled 
    ? 'background: var(--a11y-bg-elevated, #1a1a24); border: 2px solid var(--a11y-border, #5a5a70); color: var(--a11y-text, #f0f0f0);'
    : 'background: #2d1b42; border: 1px solid #6b3fa0; color: white;';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg style="width: 20px; height: 20px; color: ${enabled ? '#50d050' : '#ef4444'};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        ${enabled 
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
        }
      </svg>
      <span style="font-size: 14px; font-weight: 500;">Accessibility mode ${enabled ? 'enabled' : 'disabled'}</span>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Legacy exports
export const initializeAccessibilityMode = initializeAccessibility;
export const initializeAnimationPreference = initializeAccessibility;
export const toggleAccessibility = toggleAccessibilityMode;
export const toggleAnimations = toggleAccessibilityMode;
export const setAccessibility = setAccessibilityMode;

// Global access
declare global {
  interface Window {
    toggleAccessibilityMode: typeof toggleAccessibilityMode;
  }
}
window.toggleAccessibilityMode = toggleAccessibilityMode;
