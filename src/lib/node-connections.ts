/**
 * Node Connections
 * Animated SVG connections between floating nodes
 */

interface Connection {
  element: SVGLineElement;
  node1: Element;
  node2: Element;
  birthTime: number;
  lifetime: number;
  isForming: boolean;
  isExpiring?: boolean;
}

let activeConnections: Connection[] = [];
const maxConnections = 5;
const minConnections = 3;

/**
 * Initialize the node connection system
 */
export function initializeNodeConnections(): void {
  const floatingNodes = document.querySelectorAll('.floating-node');
  if (floatingNodes.length < 2) return;

  // Create SVG overlay for connections
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'node-connections');
  svg.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1000;';
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
  startPositionTracking(svg);
}

function maintainConnections(nodes: NodeListOf<Element>, svg: SVGSVGElement): void {
  // Create initial connections to reach minimum
  while (activeConnections.length < minConnections) {
    createNewConnection(nodes, svg);
  }

  // Schedule periodic connection management
  setInterval(() => {
    // Clean up expired connections
    activeConnections = activeConnections.filter((conn) => conn.element.parentNode);

    // Add new connections if below minimum
    if (activeConnections.length < minConnections) {
      createNewConnection(nodes, svg);
    }

    // Randomly create new connections (up to max)
    if (activeConnections.length < maxConnections && Math.random() < 0.3) {
      createNewConnection(nodes, svg);
    }
  }, 3000);
}

function createNewConnection(nodes: NodeListOf<Element>, svg: SVGSVGElement): void {
  const nodeArray = Array.from(nodes);

  // Find two nodes that aren't already connected
  let node1: Element | undefined;
  let node2: Element | undefined;
  let attempts = 0;

  do {
    node1 = nodeArray[Math.floor(Math.random() * nodeArray.length)];
    node2 = nodeArray[Math.floor(Math.random() * nodeArray.length)];
    attempts++;
  } while ((node2 === node1 || isConnectionExists(node1, node2)) && attempts < 20);

  if (!node1 || !node2 || node2 === node1 || attempts >= 20) return;

  // Get initial positions
  const pos1 = getNodePosition(node1);

  // Create connection line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(pos1.x));
  line.setAttribute('y1', String(pos1.y));
  line.setAttribute('x2', String(pos1.x));
  line.setAttribute('y2', String(pos1.y));
  line.setAttribute('stroke', 'url(#connectionGradient)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('opacity', '0');
  line.classList.add('connection-line');

  svg.appendChild(line);

  // Create connection object
  const connection: Connection = {
    element: line,
    node1,
    node2,
    birthTime: Date.now(),
    lifetime: Math.random() * 10000 + 25000, // 25-35 seconds
    isForming: true,
  };

  activeConnections.push(connection);

  // Animate line formation
  animateLineFormation(connection, svg);
}

function isConnectionExists(node1: Element | undefined, node2: Element | undefined): boolean {
  if (!node1 || !node2) return false;
  return activeConnections.some(
    (conn) => (conn.node1 === node1 && conn.node2 === node2) || (conn.node1 === node2 && conn.node2 === node1)
  );
}

function startPositionTracking(svg: SVGSVGElement): void {
  setInterval(() => {
    updateConnectionPositions();
    checkConnectionLifetimes(svg);
  }, 16); // ~60fps
}

function updateConnectionPositions(): void {
  activeConnections.forEach((connection) => {
    if (!connection.isForming && connection.element.parentNode) {
      const pos1 = getNodePosition(connection.node1);
      const pos2 = getNodePosition(connection.node2);

      connection.element.setAttribute('x1', String(pos1.x));
      connection.element.setAttribute('y1', String(pos1.y));
      connection.element.setAttribute('x2', String(pos2.x));
      connection.element.setAttribute('y2', String(pos2.y));
    }
  });
}

function checkConnectionLifetimes(svg: SVGSVGElement): void {
  const now = Date.now();

  activeConnections.forEach((connection) => {
    const age = now - connection.birthTime;

    if (age > connection.lifetime && !connection.isExpiring) {
      connection.isExpiring = true;
      expireConnection(connection, svg);
    }
  });
}

function expireConnection(connection: Connection, svg: SVGSVGElement): void {
  const pos1 = getNodePosition(connection.node1);
  const pos2 = getNodePosition(connection.node2);

  // Break into particles
  breakLineIntoParticles(pos1, pos2, svg);

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
        const index = activeConnections.indexOf(connection);
        if (index > -1) {
          activeConnections.splice(index, 1);
        }
      },
    });
  } else {
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

function getNodePosition(node: Element): { x: number; y: number } {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function animateLineFormation(connection: Connection, _svg: SVGSVGElement): void {
  const line = connection.element;

  if (typeof gsap !== 'undefined') {
    const timeline = gsap.timeline();

    timeline.to(line, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out',
    });

    timeline.to(
      line,
      {
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: function (this: { progress: () => number }) {
          const currentPos1 = getNodePosition(connection.node1);
          const currentPos2 = getNodePosition(connection.node2);
          const progress = this.progress();

          line.setAttribute('x1', String(currentPos1.x));
          line.setAttribute('y1', String(currentPos1.y));

          const endX = currentPos1.x + (currentPos2.x - currentPos1.x) * progress;
          const endY = currentPos1.y + (currentPos2.y - currentPos1.y) * progress;

          line.setAttribute('x2', String(endX));
          line.setAttribute('y2', String(endY));
        },
        onComplete: () => {
          connection.isForming = false;
        },
      },
      0.2
    );
  } else {
    line.style.opacity = '1';
    const currentPos2 = getNodePosition(connection.node2);
    line.setAttribute('x2', String(currentPos2.x));
    line.setAttribute('y2', String(currentPos2.y));
    connection.isForming = false;
  }
}

function breakLineIntoParticles(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  svg: SVGSVGElement
): void {
  const particleCount = 8;

  for (let i = 0; i < particleCount; i++) {
    const progress = i / (particleCount - 1);
    const x = pos1.x + (pos2.x - pos1.x) * progress;
    const y = pos1.y + (pos2.y - pos1.y) * progress;

    createConnectionParticle(x, y, svg);
  }
}

function createConnectionParticle(x: number, y: number, svg: SVGSVGElement): void {
  const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  particle.setAttribute('cx', String(x));
  particle.setAttribute('cy', String(y));
  particle.setAttribute('r', '3');
  particle.setAttribute('fill', 'rgba(245, 158, 11, 0.8)');
  particle.setAttribute('opacity', '1');
  particle.classList.add('connection-particle');

  svg.appendChild(particle);

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
      },
    });
  } else {
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

// GSAP type declaration
declare const gsap: {
  to: (target: Element, vars: Record<string, unknown>) => void;
  timeline: () => {
    to: (target: Element, vars: Record<string, unknown>, position?: string | number) => ReturnType<typeof gsap.timeline>;
    progress: () => number;
  };
};
