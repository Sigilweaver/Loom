# Sigilweaver.com Website

A mystical landing page for the Sigilweaver data pipeline tool, featuring an interactive frontend demo and modern web design.

## Features

- **Responsive Design**: Modern, mobile-first design with Tailwind CSS
- **Interactive Frontend Demo**: Drag-and-drop workflow builder with XML export (UI-only, no server backend)
- **Mystical Theme**: Deep purples, blues, and gold accents with enchanting animations
- **Performance Optimized**: Vanilla JavaScript with GSAP animations
- **Accessibility**: Keyboard navigation and screen reader support
- **SEO Ready**: Semantic HTML and meta tags

## Tech Stack

- **HTML5**: Semantic structure and accessibility
- **Tailwind CSS**: Utility-first styling and responsive design
- **Vanilla JavaScript**: Lightweight interactions and animations
- **GSAP**: Advanced animations and effects
- **Prism.js**: Code syntax highlighting
- **Nginx**: Web server configuration

## File Structure

```
/srv/swag/www/sigilweaver.com/
├── index.html          # Main landing page
├── demo.html           # Interactive demo page
├── demo.js             # Demo functionality
├── 404.html            # Error page
├── css/
│   └── style.css       # Custom styles and animations
├── js/
│   └── script.js       # Main site interactions
├── nginx.conf          # Nginx configuration
└── README.md           # This file
```

## Sections

### Hero Section
- Compelling tagline: "Weave Data Magic Into Reality"
- Animated background with floating nodes
- Clear call-to-action buttons

### Core Value Props
- Ultimate Flexibility (desktop, web, cloud)
- Wicked Fast Performance (Dask-powered)
- Enterprise-Grade Security (compliance ready)

### Interactive Frontend Demo
- Drag-and-drop workflow builder
- Node-based canvas interaction
- Real-time XML workflow generation
- Properties panel for node configuration

**Note**: This is a frontend-only demonstration showing the user interface. No server backend is connected - all functionality is simulated in the browser for UI preview purposes.

### Technical Features
- Frontend: React + Vite + Electron
- Backend: Python orchestrator with Dask
- Enterprise: Zero vendor lock-in, compliance ready

### Open Source
- FOSS with permissive license
- Community-driven development
- GitHub integration

## Setup Instructions

### Local Development

1. **Clone/Copy Files**:
   ```bash
   # Files are already in /srv/swag/www/sigilweaver.com/
   cd /srv/swag/www/sigilweaver.com
   ```

2. **Serve Locally** (for development):
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Access the Site**:
   - Main site: http://localhost:8000
   - Demo: http://localhost:8000/demo.html

### Production Deployment

1. **Nginx Configuration**:
   ```bash
   # Copy nginx config to sites-available
   sudo cp nginx.conf /etc/nginx/sites-available/sigilweaver.com
   
   # Enable the site
   sudo ln -s /etc/nginx/sites-available/sigilweaver.com /etc/nginx/sites-enabled/
   
   # Test configuration
   sudo nginx -t
   
   # Reload nginx
   sudo systemctl reload nginx
   ```

2. **SSL Setup** (recommended):
   ```bash
   # Using Certbot for Let's Encrypt
   sudo certbot --nginx -d sigilweaver.com -d www.sigilweaver.com
   ```

3. **DNS Configuration**:
   - Point A record for `sigilweaver.com` to your server IP
   - Point CNAME record for `www.sigilweaver.com` to `sigilweaver.com`

## Interactive Frontend Demo Features

The demo page (`/demo.html`) includes:

**Note**: This is a UI-only demonstration without server backend connectivity.

- **Node Templates**: Drag from sidebar to canvas
- **Visual Workflow**: Connect nodes with automatic line drawing
- **Properties Panel**: Configure node settings
- **XML Export**: Generate workflow XML with download option
- **Responsive Design**: Works on desktop, tablet, and mobile

### Demo Node Types

- **Data Source** (📊): CSV, database, API inputs
- **Transform** (⚙️): Data manipulation and mapping
- **Filter** (🔍): Conditional data filtering
- **Join** (🔗): Combine multiple data sources
- **Aggregate** (📈): Group and summarize data
- **Output** (💾): Save to file, database, or API

### Demo Controls

- **Drag & Drop**: Create nodes from templates
- **Click to Select**: Configure node properties
- **Mouse Drag**: Move nodes around canvas
- **Delete Key**: Remove selected node
- **Export Button**: Generate XML workflow
- **Clear Canvas**: Reset workspace

## Customization

### Color Scheme
The mystical color palette is defined in Tailwind config:
- `mystic-900` to `mystic-100`: Deep purple gradients
- `gold-300` to `gold-500`: Accent colors

### Animations
- CSS animations for floating elements
- GSAP for complex scroll-triggered animations
- Intersection Observer for performance

### Content
- All text content is in HTML for easy editing
- Node templates and properties are configurable in JavaScript
- XML generation is customizable in demo.js

## Browser Support

- **Modern Browsers**: Chrome 80+, Firefox 80+, Safari 14+, Edge 80+
- **Features Used**: CSS Grid, Flexbox, ES6+, Intersection Observer
- **Fallbacks**: Graceful degradation for older browsers

## Performance

- **Optimized Loading**: CDN resources with fallbacks
- **Minimal JavaScript**: Vanilla JS with targeted libraries
- **Efficient CSS**: Tailwind with custom optimizations
- **Image Optimization**: SVG icons and minimal graphics

## Accessibility

- **Semantic HTML**: Proper heading structure and landmarks
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: ARIA labels and descriptions
- **Color Contrast**: WCAG AA compliant contrast ratios
- **Reduced Motion**: Respects user motion preferences

## SEO Features

- **Meta Tags**: Title, description, and Open Graph
- **Structured Data**: JSON-LD for rich snippets
- **Semantic HTML**: Proper heading hierarchy
- **Fast Loading**: Optimized for Core Web Vitals

## Contact

- **Website**: sigilweaver.com
- **Email**: 
- **Support**: 
- **GitHub**: github.com/sigilweaver/sigilweaver

## License

This website template is open source. The Sigilweaver project itself uses a semi-permissive FOSS license.

---

*Sigilweaver is a passion project developed with genuine care for the data community.*
