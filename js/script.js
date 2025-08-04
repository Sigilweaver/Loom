// Sigilweaver.com Interactive JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initializeNavigation();
    initializeAnimations();
    initializeScrollEffects();
    initializeDemoCanvas();
    initializeParticles();
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            toggleMobileMenu();
        });
    }
    
    // Add click listeners to mobile menu links to close menu
    const mobileLinks = document.querySelectorAll('.mobile-link');
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            closeMobileMenu();
        });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        
        if (mobileMenu && mobileMenu.classList.contains('active')) {
            // Check if click is outside the menu and toggle button
            if (!mobileMenu.contains(event.target) && !mobileMenuToggle.contains(event.target)) {
                closeMobileMenu();
            }
        }
    });
});

// Navigation Functions
function initializeNavigation() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navigation scroll effect
    let lastScrollTop = 0;
    const nav = document.querySelector('nav');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add background blur when scrolled
        if (scrollTop > 50) {
            nav.classList.add('backdrop-blur-md', 'bg-mystic-900/95');
        } else {
            nav.classList.remove('backdrop-blur-md', 'bg-mystic-900/95');
        }
        
        lastScrollTop = scrollTop;
    });
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const toggleButton = document.getElementById('mobile-menu-toggle');
    const toggleIcon = toggleButton.querySelector('svg path');
    
    if (mobileMenu) {
        const isActive = mobileMenu.classList.toggle('active');
        
        if (isActive) {
            // Change to close icon (X)
            toggleIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
        } else {
            // Change back to hamburger icon
            toggleIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
        }
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const toggleButton = document.getElementById('mobile-menu-toggle');
    const toggleIcon = toggleButton.querySelector('svg path');
    
    if (mobileMenu) {
        mobileMenu.classList.remove('active');
    }
    
    // Reset hamburger icon
    if (toggleIcon) {
        toggleIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
    }
}

// Animation Functions
function initializeAnimations() {
    // GSAP animations for hero section
    if (typeof gsap !== 'undefined') {
        // Hero text animation
        gsap.fromTo('.hero h1', 
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 1, delay: 0.5, ease: 'power2.out' }
        );
        
        gsap.fromTo('.hero p', 
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 1, delay: 0.8, ease: 'power2.out' }
        );
        
        gsap.fromTo('.hero .flex', 
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 1, delay: 1.1, ease: 'power2.out' }
        );

        // Floating elements animation
        gsap.to('.floating-node', {
            y: -20,
            duration: 3,
            repeat: -1,
            yoyo: true,
            ease: 'power2.inOut',
            stagger: 0.5
        });
    }
}

function initializeScrollEffects() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                
                // Trigger specific animations based on element
                if (entry.target.classList.contains('use-case-card')) {
                    animateUseCaseCard(entry.target);
                } else if (entry.target.classList.contains('tech-item')) {
                    animateTechItem(entry.target);
                }
            }
        });
    }, observerOptions);

    // Observe elements
    const elementsToAnimate = document.querySelectorAll('.use-case-card, .tech-item, .bg-mystic-700\\/30');
    elementsToAnimate.forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}

function animateUseCaseCard(card) {
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(card, 
            { opacity: 0, scale: 0.9, rotationY: -15 },
            { opacity: 1, scale: 1, rotationY: 0, duration: 0.8, ease: 'back.out(1.7)' }
        );
    }
}

function animateTechItem(item) {
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(item, 
            { opacity: 0, x: -30 },
            { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' }
        );
    }
}

// Demo Canvas Functions
function initializeDemoCanvas() {
    const demoCanvas = document.querySelector('.demo-canvas');
    if (!demoCanvas) return;

    // Create interactive demo elements
    createDemoNodes(demoCanvas);
    
    // Add click handlers for demo interaction
    demoCanvas.addEventListener('click', handleDemoInteraction);
}

function createDemoNodes(canvas) {
    const nodes = [
        { id: 'input', label: 'Data Input', x: 10, y: 20, type: 'source' },
        { id: 'transform', label: 'Transform', x: 40, y: 20, type: 'process' },
        { id: 'output', label: 'Output', x: 70, y: 20, type: 'sink' }
    ];
    
    nodes.forEach(node => {
        const nodeElement = document.createElement('div');
        nodeElement.className = `demo-node demo-node-${node.type}`;
        nodeElement.style.left = `${node.x}%`;
        nodeElement.style.top = `${node.y}%`;
        nodeElement.innerHTML = `
            <div class="node-content">
                <div class="node-icon">${getNodeIcon(node.type)}</div>
                <div class="node-label">${node.label}</div>
            </div>
        `;
        
        canvas.appendChild(nodeElement);
    });
    
    // Add connecting lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'demo-connections';
    svg.innerHTML = `
        <line x1="15%" y1="25%" x2="35%" y2="25%" stroke="rgba(139, 92, 246, 0.6)" stroke-width="2"/>
        <line x1="45%" y1="25%" x2="65%" y2="25%" stroke="rgba(139, 92, 246, 0.6)" stroke-width="2"/>
    `;
    canvas.appendChild(svg);
}

function getNodeIcon(type) {
    const icons = {
        source: '📊',
        process: '⚙️',
        sink: '💾'
    };
    return icons[type] || '📋';
}

function handleDemoInteraction(event) {
    const node = event.target.closest('.demo-node');
    if (node) {
        // Add pulse animation to clicked node
        node.classList.add('pulse-animation');
        setTimeout(() => {
            node.classList.remove('pulse-animation');
        }, 1000);
        
        // Show tooltip or info
        showNodeInfo(node);
    }
}

function showNodeInfo(node) {
    // Remove existing tooltips
    document.querySelectorAll('.node-tooltip').forEach(tooltip => tooltip.remove());
    
    const tooltip = document.createElement('div');
    tooltip.className = 'node-tooltip';
    tooltip.innerHTML = `
        <div class="bg-mystic-800 border border-mystic-600 rounded-lg p-3 text-sm max-w-xs">
            <p class="text-mystic-200 font-semibold mb-1">Node Configuration</p>
            <p class="text-mystic-400">Click and drag to connect nodes, configure properties, and build your data pipeline.</p>
        </div>
    `;
    
    node.appendChild(tooltip);
    
    // Auto-remove tooltip after 3 seconds
    setTimeout(() => {
        tooltip.remove();
    }, 3000);
}

// Particle System
function initializeParticles() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particles';
    document.body.appendChild(particleContainer);
    
    // Create particles
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            createParticle(particleContainer);
        }, i * 100);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random position
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    
    // Random animation delay and duration
    particle.style.animationDelay = Math.random() * 8 + 's';
    particle.style.animationDuration = (Math.random() * 6 + 4) + 's';
    
    // Random opacity
    particle.style.opacity = Math.random() * 0.5 + 0.1;
    
    container.appendChild(particle);
    
    // Remove and recreate particle after animation
    setTimeout(() => {
        if (particle.parentNode) {
            particle.remove();
            createParticle(container);
        }
    }, 8000);
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Performance optimizations
const optimizedScrollHandler = debounce(() => {
    // Handle scroll-based animations and effects
    updateParallaxElements();
}, 16); // ~60fps

function updateParallaxElements() {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.workflow-canvas');
    
    parallaxElements.forEach(element => {
        const speed = 0.5;
        element.style.transform = `translateY(${scrolled * speed}px)`;
    });
}

window.addEventListener('scroll', optimizedScrollHandler);

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    // Could implement error reporting here
});

// Accessibility improvements
document.addEventListener('keydown', function(e) {
    // Add keyboard navigation support
    if (e.key === 'Tab') {
        document.body.classList.add('using-keyboard');
    }
});

document.addEventListener('mousedown', function() {
    document.body.classList.remove('using-keyboard');
});

// CSS for demo nodes (injected via JavaScript)
const demoStyles = `
<style>
.demo-node {
    position: absolute;
    width: 80px;
    height: 60px;
    background: rgba(76, 42, 107, 0.8);
    border: 2px solid rgba(139, 92, 246, 0.6);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
}

.demo-node:hover {
    border-color: rgba(245, 158, 11, 0.8);
    transform: scale(1.05);
}

.demo-node-source {
    border-color: rgba(34, 197, 94, 0.6);
}

.demo-node-process {
    border-color: rgba(139, 92, 246, 0.6);
}

.demo-node-sink {
    border-color: rgba(239, 68, 68, 0.6);
}

.node-content {
    text-align: center;
    color: white;
}

.node-icon {
    font-size: 20px;
    margin-bottom: 2px;
}

.node-label {
    font-size: 10px;
    font-weight: 500;
}

.demo-connections {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.pulse-animation {
    animation: pulse 1s ease-in-out;
}

.node-tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    margin-top: 5px;
}

@media (max-width: 768px) {
    .demo-node {
        width: 60px;
        height: 45px;
    }
    
    .node-icon {
        font-size: 16px;
    }
    
    .node-label {
        font-size: 8px;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', demoStyles);


