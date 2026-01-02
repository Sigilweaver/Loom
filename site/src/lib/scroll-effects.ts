/**
 * Scroll Effects
 * Intersection Observer-based scroll animations
 */

import gsap from 'gsap';

/**
 * Check if accessibility mode is enabled
 */
function isA11yMode(): boolean {
  return document.documentElement.classList.contains('a11y');
}

/**
 * Initialize scroll-triggered animations
 */
export function initializeScrollEffects(): void {
  if (isA11yMode() || document.documentElement.classList.contains('animations-disabled')) {
    return;
  }

  const observerOptions: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');

        // Trigger specific animations based on element
        if (entry.target.classList.contains('use-case-card')) {
          animateUseCaseCard(entry.target as HTMLElement);
        } else if (entry.target.classList.contains('tech-item')) {
          animateTechItem(entry.target as HTMLElement);
        }
      }
    });
  }, observerOptions);

  // Observe elements
  const elementsToAnimate = document.querySelectorAll('.use-case-card, .tech-item, .bg-mystic-700\\/30');
  elementsToAnimate.forEach((el) => {
    el.classList.add('animate-on-scroll');
    observer.observe(el);
  });
}

/**
 * Animate use case cards
 */
function animateUseCaseCard(card: HTMLElement): void {
  gsap.fromTo(
    card,
    { opacity: 0, scale: 0.9, rotationY: -15 },
    { opacity: 1, scale: 1, rotationY: 0, duration: 0.8, ease: 'back.out(1.7)' }
  );
}

/**
 * Animate tech items
 */
function animateTechItem(item: HTMLElement): void {
  gsap.fromTo(item, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' });
}

/**
 * Initialize hero animations (GSAP)
 */
export function initializeHeroAnimations(): void {
  if (isA11yMode() || document.documentElement.classList.contains('animations-disabled')) {
    return;
  }

  gsap.fromTo(
    '.hero h1',
    { opacity: 0, y: 50 },
    {
      opacity: 1,
      y: 0,
      duration: 1,
      delay: 0.5,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    }
  );

  gsap.fromTo(
    '.hero p',
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 1,
      delay: 0.8,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    }
  );

  gsap.fromTo(
    '.hero .flex',
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 1.1,
      delay: 1.1,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    }
  );
}
