// Sigilweaver.com Interactive JavaScript

// Initialize loading state
let isInitialized = false;
let loadingErrors = [];

document.addEventListener('DOMContentLoaded', function() {
    // Show loading indicator
    showLoadingState();
    
    try {
        // Initialize all components
        initializeNavigation();
        initializeAnimations();
        initializeScrollEffects();
        initializeDemoCanvas();
        initializeParticles();
        initializeNodeConnections();
        
        // Set mobile menu position based on nav height
        const mobileMenu = document.getElementById('mobile-menu');
        const nav = document.querySelector('nav');
        if (mobileMenu && nav) {
            const navHeight = nav.offsetHeight;
            mobileMenu.style.top = navHeight + 'px';
        }
        
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
        
        // Mark as initialized
        isInitialized = true;
        hideLoadingState();
        
    } catch (error) {
        console.error('Initialization error:', error);
        loadingErrors.push(error);
        showErrorState('Failed to initialize some components. The site should still be functional.');
    }
});

// Loading state management
function showLoadingState() {
    const existingIndicator = document.getElementById('loading-indicator');
    if (existingIndicator) return;
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.className = 'fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-mystic-600 to-gold-500 z-50';
    loadingIndicator.style.animation = 'loading-progress 2s ease-in-out infinite';
    loadingIndicator.setAttribute('aria-label', 'Page loading');
    
    document.body.appendChild(loadingIndicator);
}

function hideLoadingState() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.animation = 'none';
        loadingIndicator.style.transform = 'scaleX(1)';
        setTimeout(() => {
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
                loadingIndicator.remove();
            }, 300);
        }, 200);
    }
}

function showErrorState(message) {
    const errorNotification = document.createElement('div');
    errorNotification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm';
    errorNotification.setAttribute('role', 'alert');
    errorNotification.innerHTML = `
        <div class="flex items-center space-x-2">
            <span class="text-sm">${message}</span>
            <button class="ml-2 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()" aria-label="Dismiss notification">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(errorNotification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorNotification.parentNode) {
            errorNotification.style.opacity = '0';
            setTimeout(() => {
                errorNotification.remove();
            }, 300);
        }
    }, 5000);
}

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
    const nav = document.querySelector('nav');
    
    if (mobileMenu) {
        // Calculate nav height and position mobile menu accordingly
        const navHeight = nav.offsetHeight;
        mobileMenu.style.top = navHeight + 'px';
        
        const isActive = mobileMenu.classList.toggle('active');
        
        // Update ARIA attributes
        toggleButton.setAttribute('aria-expanded', isActive);
        
        if (isActive) {
            // Change to close icon (X)
            toggleIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
            // Focus management
            const firstMenuItem = mobileMenu.querySelector('a');
            if (firstMenuItem) {
                setTimeout(() => firstMenuItem.focus(), 100);
            }
            // Trap focus in mobile menu
            trapFocus(mobileMenu);
        } else {
            // Change back to hamburger icon
            toggleIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
            // Return focus to toggle button
            toggleButton.focus();
            // Remove focus trap
            removeFocusTrap();
        }
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const toggleButton = document.getElementById('mobile-menu-toggle');
    const toggleIcon = toggleButton.querySelector('svg path');
    
    if (mobileMenu && mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        toggleButton.setAttribute('aria-expanded', 'false');
        
        // Reset hamburger icon
        if (toggleIcon) {
            toggleIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
        }
        
        // Remove focus trap
        removeFocusTrap();
    }
}

// Focus trap functionality for accessibility
let focusTrapElements = [];
let firstFocusableElement = null;
let lastFocusableElement = null;

function trapFocus(container) {
    const focusableElementsSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    focusTrapElements = container.querySelectorAll(focusableElementsSelector);
    
    if (focusTrapElements.length > 0) {
        firstFocusableElement = focusTrapElements[0];
        lastFocusableElement = focusTrapElements[focusTrapElements.length - 1];
        
        document.addEventListener('keydown', handleFocusTrap);
    }
}

function removeFocusTrap() {
    document.removeEventListener('keydown', handleFocusTrap);
    focusTrapElements = [];
    firstFocusableElement = null;
    lastFocusableElement = null;
}

function handleFocusTrap(e) {
    if (e.key === 'Tab') {
        if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === firstFocusableElement) {
                e.preventDefault();
                lastFocusableElement.focus();
            }
        } else { // Tab
            if (document.activeElement === lastFocusableElement) {
                e.preventDefault();
                firstFocusableElement.focus();
            }
        }
    } else if (e.key === 'Escape') {
        closeMobileMenu();
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

// Node Connection System
let activeConnections = [];
let maxConnections = 5;
let minConnections = 3;
let connectionUpdateInterval;

function initializeNodeConnections() {
    const floatingNodes = document.querySelectorAll('.floating-node');
    if (floatingNodes.length < 2) return;
    
    // Create SVG overlay for connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'node-connections';
    svg.style.position = 'fixed';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '-1000';
    document.body.appendChild(svg);
    
    // Create gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'connectionGradient');
    gradient.innerHTML = `
        <stop offset="0%" stop-color="rgba(139, 92, 246, 0.8)"/>
        <stop offset="50%" stop-color="rgba(245, 158, 11, 1)"/>
        <stop offset="100%" stop-color="rgba(139, 92, 246, 0.8)"/>
    `;
    defs.appendChild(gradient);
    svg.appendChild(defs);
    
    // Start the connection system
    maintainConnections(floatingNodes, svg);
    
    // Update node positions every frame for smooth tracking
    startPositionTracking(svg);
}

function maintainConnections(nodes, svg) {
    // Create initial connections to reach minimum
    while (activeConnections.length < minConnections) {
        createNewConnection(nodes, svg);
    }
    
    // Schedule periodic connection management
    setInterval(() => {
        // Clean up expired connections
        activeConnections = activeConnections.filter(conn => conn.element.parentNode);
        
        // Add new connections if below minimum
        if (activeConnections.length < minConnections) {
            createNewConnection(nodes, svg);
        }
        
        // Randomly create new connections (up to max) every 3-8 seconds
        if (activeConnections.length < maxConnections && Math.random() < 0.3) {
            createNewConnection(nodes, svg);
        }
    }, 3000);
}

function createNewConnection(nodes, svg) {
    const nodeArray = Array.from(nodes);
    
    // Find two nodes that aren't already connected
    let node1, node2;
    let attempts = 0;
    do {
        node1 = nodeArray[Math.floor(Math.random() * nodeArray.length)];
        node2 = nodeArray[Math.floor(Math.random() * nodeArray.length)];
        attempts++;
    } while ((node2 === node1 || isConnectionExists(node1, node2)) && attempts < 20);
    
    if (node2 === node1 || attempts >= 20) return;
    
    // Get initial positions
    const pos1 = getNodePosition(node1);
    const pos2 = getNodePosition(node2);
    
    // Create connection line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', pos1.x);
    line.setAttribute('y1', pos1.y);
    line.setAttribute('x2', pos1.x); // Start from same position
    line.setAttribute('y2', pos1.y);
    line.setAttribute('stroke', 'url(#connectionGradient)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('opacity', '0');
    line.className = 'connection-line';
    
    svg.appendChild(line);
    
    // Create connection object
    const connection = {
        element: line,
        node1: node1,
        node2: node2,
        birthTime: Date.now(),
        lifetime: Math.random() * 10000 + 25000, // 25-35 seconds
        isForming: true
    };
    
    activeConnections.push(connection);
    
    // Animate line formation
    animateLineFormation(connection, pos1, pos2, svg);
}

function isConnectionExists(node1, node2) {
    return activeConnections.some(conn => 
        (conn.node1 === node1 && conn.node2 === node2) ||
        (conn.node1 === node2 && conn.node2 === node1)
    );
}

function startPositionTracking(svg) {
    // Update positions at 60fps for smooth tracking
    connectionUpdateInterval = setInterval(() => {
        updateConnectionPositions();
        checkConnectionLifetimes(svg);
    }, 16); // ~60fps
}

function updateConnectionPositions() {
    activeConnections.forEach(connection => {
        if (!connection.isForming && connection.element.parentNode) {
            const pos1 = getNodePosition(connection.node1);
            const pos2 = getNodePosition(connection.node2);
            
            connection.element.setAttribute('x1', pos1.x);
            connection.element.setAttribute('y1', pos1.y);
            connection.element.setAttribute('x2', pos2.x);
            connection.element.setAttribute('y2', pos2.y);
        }
    });
}

function checkConnectionLifetimes(svg) {
    const now = Date.now();
    
    activeConnections.forEach((connection, index) => {
        const age = now - connection.birthTime;
        
        if (age > connection.lifetime && !connection.isExpiring) {
            connection.isExpiring = true;
            expireConnection(connection, svg);
        }
    });
}

function expireConnection(connection, svg) {
    const pos1 = getNodePosition(connection.node1);
    const pos2 = getNodePosition(connection.node2);
    
    // Break into particles
    breakLineIntoParticles(connection.element, pos1, pos2, svg);
    
    // Fade out the line
    if (typeof gsap !== 'undefined') {
        gsap.to(connection.element, {
            opacity: 0,
            duration: 2,
            ease: 'power2.in',
            onComplete: () => {
                if (connection.element.parentNode) {
                    connection.element.remove();
                }
                // Remove from active connections
                const index = activeConnections.indexOf(connection);
                if (index > -1) {
                    activeConnections.splice(index, 1);
                }
            }
        });
    } else {
        // Fallback without GSAP
        setTimeout(() => {
            if (connection.element.parentNode) {
                connection.element.remove();
            }
            const index = activeConnections.indexOf(connection);
            if (index > -1) {
                activeConnections.splice(index, 1);
            }
        }, 2000);
    }
}

function getNodePosition(node) {
    const rect = node.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

function animateLineFormation(connection, pos1, pos2, svg) {
    const line = connection.element;
    
    // Phase 1: Fade in and draw line (2 seconds)
    if (typeof gsap !== 'undefined') {
        const timeline = gsap.timeline();
        
        // Fade in
        timeline.to(line, {
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out'
        });
        
        // Draw line to target while tracking node positions during formation
        timeline.to(line, {
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: function() {
                // Continuously update positions during formation
                const currentPos1 = getNodePosition(connection.node1);
                const currentPos2 = getNodePosition(connection.node2);
                
                // Calculate progress of the line drawing (0 to 1)
                const progress = this.progress();
                
                // Update start position to current node1 position
                line.setAttribute('x1', currentPos1.x);
                line.setAttribute('y1', currentPos1.y);
                
                // Animate end position from start to current node2 position
                const endX = currentPos1.x + (currentPos2.x - currentPos1.x) * progress;
                const endY = currentPos1.y + (currentPos2.y - currentPos1.y) * progress;
                
                line.setAttribute('x2', endX);
                line.setAttribute('y2', endY);
            },
            onComplete: () => {
                connection.isForming = false; // Now it will track positions in the main loop
            }
        }, 0.2);
        
    } else {
        // Fallback without GSAP
        line.style.opacity = '1';
        const currentPos2 = getNodePosition(connection.node2);
        line.setAttribute('x2', currentPos2.x);
        line.setAttribute('y2', currentPos2.y);
        connection.isForming = false;
    }
}

function breakLineIntoParticles(line, pos1, pos2, svg) {
    const particleCount = 8;
    const lineLength = Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
    
    for (let i = 0; i < particleCount; i++) {
        const progress = i / (particleCount - 1);
        const x = pos1.x + (pos2.x - pos1.x) * progress;
        const y = pos1.y + (pos2.y - pos1.y) * progress;
        
        createConnectionParticle(x, y, svg);
    }
}

function createConnectionParticle(x, y, svg) {
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    particle.setAttribute('cx', x);
    particle.setAttribute('cy', y);
    particle.setAttribute('r', '3');
    particle.setAttribute('fill', 'rgba(245, 158, 11, 0.8)');
    particle.setAttribute('opacity', '1');
    particle.className = 'connection-particle';
    
    svg.appendChild(particle);
    
    // Animate particle dispersal
    if (typeof gsap !== 'undefined') {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 100 + 50;
        const endX = x + Math.cos(angle) * distance;
        const endY = y + Math.sin(angle) * distance;
        
        gsap.to(particle, {
            attr: { cx: endX, cy: endY, r: 1 },
            opacity: 0,
            duration: 4,
            ease: 'power1.out',
            onComplete: () => {
                if (particle.parentNode) {
                    particle.remove();
                }
            }
        });
    } else {
        // Fallback without GSAP
        setTimeout(() => {
            particle.style.opacity = '0';
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.remove();
                }
            }, 3000);
        }, 1000);
    }
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

// Error handling with performance monitoring
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    
    // Performance monitoring - track errors
    if ('performance' in window && 'mark' in window.performance) {
        performance.mark('error-occurred');
    }
    
    // Could implement error reporting here
    logErrorMetrics({
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        timestamp: Date.now()
    });
});

// Performance monitoring
function logErrorMetrics(errorData) {
    // In a real application, you would send this to your analytics service
    if (window.localStorage) {
        try {
            const errors = JSON.parse(localStorage.getItem('sigilweaver_errors') || '[]');
            errors.push(errorData);
            // Keep only last 10 errors to avoid localStorage bloat
            if (errors.length > 10) {
                errors.splice(0, errors.length - 10);
            }
            localStorage.setItem('sigilweaver_errors', JSON.stringify(errors));
        } catch (e) {
            console.warn('Could not log error metrics:', e);
        }
    }
}

// Performance metrics collection
function collectPerformanceMetrics() {
    if ('performance' in window && 'getEntriesByType' in window.performance) {
        const navigationEntries = performance.getEntriesByType('navigation');
        const paintEntries = performance.getEntriesByType('paint');
        
        if (navigationEntries.length > 0) {
            const nav = navigationEntries[0];
            const metrics = {
                domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                loadComplete: nav.loadEventEnd - nav.loadEventStart,
                firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || null,
                firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || null,
                timestamp: Date.now()
            };
            
            // Log metrics (in production, send to analytics service)
            if (window.localStorage) {
                try {
                    localStorage.setItem('sigilweaver_performance', JSON.stringify(metrics));
                } catch (e) {
                    console.warn('Could not save performance metrics:', e);
                }
            }
        }
    }
}

// Collect performance metrics after page load
window.addEventListener('load', function() {
    // Delay collection to ensure all metrics are available
    setTimeout(collectPerformanceMetrics, 1000);
});

// Intersection Observer for lazy loading optimization
const lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const element = entry.target;
            
            // Lazy load images
            if (element.tagName === 'IMG' && element.dataset.src) {
                element.src = element.dataset.src;
                element.removeAttribute('data-src');
                lazyLoadObserver.unobserve(element);
            }
            
            // Trigger animations for elements coming into view
            if (element.classList.contains('animate-on-scroll')) {
                element.classList.add('animate');
                if (typeof gsap !== 'undefined') {
                    gsap.fromTo(element, 
                        { opacity: 0, y: 30 },
                        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
                    );
                }
            }
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '50px'
});

// Auto-observe elements with lazy loading attributes
document.addEventListener('DOMContentLoaded', function() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    
    [...lazyImages, ...animateElements].forEach(element => {
        lazyLoadObserver.observe(element);
    });
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


