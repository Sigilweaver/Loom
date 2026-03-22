/**
 * Beta Banner Component
 * Displays a private beta notice below the navigation header
 */

/**
 * Creates the private beta banner HTML
 */
export function createBetaBanner(): string {
  return `
    <div class="fixed top-[72px] w-full z-40 bg-gold-500/90 backdrop-blur-sm text-mystic-900 text-center text-sm py-2 px-4 font-medium" role="status">
      <span class="inline-flex items-center gap-2 flex-wrap justify-center">
        <span class="bg-mystic-900 text-gold-400 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider">Private Beta</span>
        <span>Sigilweaver Loom is in private beta — the repository is private and some features may not be fully connected yet.</span>
      </span>
    </div>
  `;
}
