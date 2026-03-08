/**
 * Navigation functionality
 * Handles mobile menu, smooth scrolling, and scroll effects
 */

/**
 * Initialize navigation functionality
 */
export function initializeNavigation(): void {
  initializeSmoothScrolling();
  initializeScrollEffect();
  initializeMobileMenu();
}

/**
 * Smooth scrolling for anchor links
 */
function initializeSmoothScrolling(): void {
  const navLinks = document.querySelectorAll('a[href^="#"]');
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      // Re-check href at click time — it may have been updated dynamically
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });
}

/**
 * Navigation scroll effect (blur on scroll)
 */
function initializeScrollEffect(): void {
  const nav = document.querySelector('nav');
  if (!nav) return;

  let scrollTicking = false;

  window.addEventListener(
    'scroll',
    () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

          if (scrollTop > 50) {
            nav.classList.add('backdrop-blur-md', 'bg-mystic-900/95');
          } else {
            nav.classList.remove('backdrop-blur-md', 'bg-mystic-900/95');
          }

          scrollTicking = false;
        });
        scrollTicking = true;
      }
    },
    { passive: true }
  );
}

/**
 * Mobile menu functionality
 */
function initializeMobileMenu(): void {
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const nav = document.querySelector('nav');

  if (!mobileMenu || !mobileMenuToggle || !nav) return;

  // Set mobile menu position based on nav height
  const navHeight = nav.offsetHeight;
  mobileMenu.style.top = `${navHeight}px`;

  // Toggle button click
  mobileMenuToggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMobileMenu();
  });

  // Close menu when clicking mobile links
  const mobileLinks = document.querySelectorAll('.mobile-link');
  mobileLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (event) => {
    if (mobileMenu.classList.contains('active')) {
      const target = event.target as Node;
      if (!mobileMenu.contains(target) && !mobileMenuToggle.contains(target)) {
        closeMobileMenu();
      }
    }
  });

  // Handle keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
      closeMobileMenu();
      mobileMenuToggle.focus();
    }
  });
}

/**
 * Toggle mobile menu open/closed
 */
export function toggleMobileMenu(): void {
  const mobileMenu = document.getElementById('mobile-menu');
  const toggleButton = document.getElementById('mobile-menu-toggle');
  const toggleIcon = toggleButton?.querySelector('svg path');
  const nav = document.querySelector('nav');

  if (!mobileMenu || !toggleButton || !nav) return;

  // Update position
  const navHeight = nav.offsetHeight;
  mobileMenu.style.top = `${navHeight}px`;

  const isActive = mobileMenu.classList.toggle('active');
  toggleButton.setAttribute('aria-expanded', String(isActive));

  if (toggleIcon) {
    if (isActive) {
      toggleIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      // Focus first menu item
      const firstMenuItem = mobileMenu.querySelector('a');
      if (firstMenuItem) {
        setTimeout(() => (firstMenuItem as HTMLElement).focus(), 100);
      }
    } else {
      toggleIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
    }
  }
}

/**
 * Close mobile menu
 */
export function closeMobileMenu(): void {
  const mobileMenu = document.getElementById('mobile-menu');
  const toggleButton = document.getElementById('mobile-menu-toggle');
  const toggleIcon = toggleButton?.querySelector('svg path');

  if (!mobileMenu || !toggleButton) return;

  mobileMenu.classList.remove('active');
  toggleButton.setAttribute('aria-expanded', 'false');

  if (toggleIcon) {
    toggleIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
  }
}
