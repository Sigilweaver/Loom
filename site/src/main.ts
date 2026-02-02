/**
 * Main entry point
 * Initializes the site with all shared functionality
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeNavigation } from '@lib/navigation';
import { createIcons, Shield, Check, Globe, Clipboard, AlertTriangle, BookOpen, Search, Sparkles, Lock, Lightbulb, Key, MessageSquare, UserCog, Moon, Settings, Brush, Coffee, Clock, Loader2, Zap, Wrench, Timer, Bomb, UserX, RefreshCw, FileText, Mail, Wand2, Menu, Heart, Target } from 'lucide';

// Export for use by page-specific scripts
export { initializeLayout } from '@lib/layout';
export { initializeNavigation } from '@lib/navigation';
export * from '@components/index';
export * from '@lib/config';

/**
 * Initialize all site functionality
 * Called on DOMContentLoaded
 */
export function initializeSite(): void {
  // Initialize layout components
  initializeLayout();
  
  // Initialize icons for static HTML
  createIcons({
    icons: {
      Shield, Check, Globe, Clipboard, AlertTriangle, BookOpen, Search, Sparkles, Lock, Lightbulb, Key, MessageSquare, UserCog, Moon, Settings, Brush, Coffee, Clock, Loader2, Zap, Wrench, Timer, Bomb, UserX, RefreshCw, FileText, Mail, Wand2, Menu, Heart, Target
    }
  });
  
  // Initialize navigation
  initializeNavigation();
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSite);
