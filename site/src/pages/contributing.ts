/**
 * Contributing page entry point
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeNavigation } from '@lib/navigation';
import { createIcons, Wand2, Server, Network, Scroll, Globe, BookOpen, Rocket, Heart } from 'lucide';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializeLayout();
  initializeNavigation();
  
  // Initialize icons
  createIcons({
    icons: {
      Wand2, Server, Network, Scroll, Globe, BookOpen, Rocket, Heart
    }
  });
});
