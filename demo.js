// Sigilweaver Interactive Demo
class SigilweaverDemo {
    constructor() {
        this.canvas = document.getElementById('demo-canvas');
        this.workflowContainer = document.getElementById('workflow-container');
        this.propertiesPanel = document.getElementById('properties-content');
        
        this.nodes = new Map();
        this.connections = [];
        this.selectedNode = null;
        this.nodeCounter = 0;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createSampleWorkflow();
    }
    
    setupEventListeners() {
        // Node template drag and drop
        const templates = document.querySelectorAll('.node-template');
        templates.forEach(template => {
            template.addEventListener('dragstart', this.handleTemplateeDragStart.bind(this));
            template.addEventListener('dragend', this.handleTemplateDragEnd.bind(this));
        });
        
        // Canvas drop
        this.canvas.addEventListener('dragover', this.handleCanvasDragOver.bind(this));
        this.canvas.addEventListener('drop', this.handleCanvasDrop.bind(this));
        
        // Canvas click (deselect)
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // Buttons
        document.getElementById('clear-canvas').addEventListener('click', this.clearCanvas.bind(this));
        document.getElementById('export-workflow').addEventListener('click', this.exportWorkflow.bind(this));
        document.getElementById('close-modal').addEventListener('click', this.closeModal.bind(this));
        document.getElementById('copy-xml').addEventListener('click', this.copyXML.bind(this));
        document.getElementById('download-xml').addEventListener('click', this.downloadXML.bind(this));
        
        // Mouse events for node dragging
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    handleTemplateeDragStart(e) {
        const template = e.target.closest('.node-template');
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: template.dataset.type,
            icon: template.dataset.icon,
            title: template.dataset.title
        }));
    }
    
    handleTemplateDragEnd(e) {
        // Clean up any drag effects
    }
    
    handleCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
    
    handleCanvasDrop(e) {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.createNode(data.type, data.icon, data.title, x, y);
    }
    
    handleCanvasClick(e) {
        if (e.target === this.canvas || e.target.classList.contains('grid-background')) {
            this.deselectAllNodes();
        }
    }
    
    handleMouseDown(e) {
        const node = e.target.closest('.workflow-node');
        if (node) {
            e.preventDefault();
            this.selectNode(node);
            this.isDragging = true;
            
            const rect = node.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            node.style.zIndex = '1000';
        }
    }
    
    handleMouseMove(e) {
        if (this.isDragging && this.selectedNode) {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left - this.dragOffset.x;
            const y = e.clientY - rect.top - this.dragOffset.y;
            
            // Keep node within canvas bounds
            const maxX = this.canvas.clientWidth - this.selectedNode.offsetWidth;
            const maxY = this.canvas.clientHeight - this.selectedNode.offsetHeight;
            
            const clampedX = Math.max(0, Math.min(x, maxX));
            const clampedY = Math.max(0, Math.min(y, maxY));
            
            this.selectedNode.style.left = clampedX + 'px';
            this.selectedNode.style.top = clampedY + 'px';
            
            // Update node data
            const nodeId = this.selectedNode.dataset.nodeId;
            const nodeData = this.nodes.get(nodeId);
            if (nodeData) {
                nodeData.x = clampedX;
                nodeData.y = clampedY;
            }
            
            this.updateConnections();
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging && this.selectedNode) {
            this.selectedNode.style.zIndex = '';
            this.isDragging = false;
        }
    }
    
    createNode(type, icon, title, x, y) {
        this.nodeCounter++;
        const nodeId = `node_${this.nodeCounter}`;
        
        const node = document.createElement('div');
        node.className = `workflow-node ${type}`;
        node.dataset.nodeId = nodeId;
        node.style.left = x + 'px';
        node.style.top = y + 'px';
        
        node.innerHTML = `
            <div class="node-icon">${icon}</div>
            <div class="node-title">${title}</div>
        `;
        
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(node);
        });
        
        this.workflowContainer.appendChild(node);
        
        // Store node data
        const nodeData = {
            id: nodeId,
            type: type,
            icon: icon,
            title: title,
            x: x,
            y: y,
            properties: this.getDefaultProperties(type)
        };
        
        this.nodes.set(nodeId, nodeData);
        
        // Auto-select new node
        this.selectNode(node);
        
        return node;
    }
    
    getDefaultProperties(type) {
        const defaults = {
            source: {
                'Source Type': 'CSV File',
                'File Path': '/data/input.csv',
                'Delimiter': ',',
                'Header Row': 'true'
            },
            transform: {
                'Operation': 'Map Columns',
                'Expression': 'column1 + column2',
                'Output Column': 'result'
            },
            filter: {
                'Condition': 'value > 100',
                'Keep Matching': 'true'
            },
            join: {
                'Join Type': 'inner',
                'Left Key': 'id',
                'Right Key': 'user_id'
            },
            aggregate: {
                'Group By': 'category',
                'Aggregation': 'sum(amount)',
                'Output Column': 'total'
            },
            sink: {
                'Output Type': 'CSV File',
                'File Path': '/data/output.csv',
                'Overwrite': 'true'
            }
        };
        
        return defaults[type] || {};
    }
    
    selectNode(node) {
        this.deselectAllNodes();
        node.classList.add('selected');
        this.selectedNode = node;
        
        const nodeId = node.dataset.nodeId;
        const nodeData = this.nodes.get(nodeId);
        this.showProperties(nodeData);
    }
    
    deselectAllNodes() {
        document.querySelectorAll('.workflow-node').forEach(node => {
            node.classList.remove('selected');
        });
        this.selectedNode = null;
        this.showProperties(null);
    }
    
    showProperties(nodeData) {
        if (!nodeData) {
            this.propertiesPanel.innerHTML = `
                <div class="text-xs text-mystic-400 text-center py-8">
                    Select a node to view its properties
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="property-group">
                <div class="property-label">Node Information</div>
                <div class="text-xs text-mystic-300 mb-2">Type: ${nodeData.type}</div>
                <div class="text-xs text-mystic-300 mb-2">ID: ${nodeData.id}</div>
            </div>
        `;
        
        html += `<div class="property-group">
            <div class="property-label">Node Properties</div>`;
        
        for (const [key, value] of Object.entries(nodeData.properties)) {
            html += `
                <div class="mb-3">
                    <label class="block text-xs text-mystic-400 mb-1">${key}</label>
                    <input type="text" 
                           class="property-input" 
                           value="${value}" 
                           data-node-id="${nodeData.id}"
                           data-property="${key}">
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Add delete button
        html += `
            <div class="property-group">
                <button class="w-full bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs transition-colors"
                        onclick="demo.deleteNode('${nodeData.id}')">
                    Delete Node
                </button>
            </div>
        `;
        
        this.propertiesPanel.innerHTML = html;
        
        // Add event listeners to property inputs
        this.propertiesPanel.querySelectorAll('.property-input').forEach(input => {
            input.addEventListener('input', this.updateNodeProperty.bind(this));
        });
    }
    
    updateNodeProperty(e) {
        const nodeId = e.target.dataset.nodeId;
        const property = e.target.dataset.property;
        const value = e.target.value;
        
        const nodeData = this.nodes.get(nodeId);
        if (nodeData) {
            nodeData.properties[property] = value;
        }
    }
    
    deleteNode(nodeId) {
        const node = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (node) {
            node.remove();
            this.nodes.delete(nodeId);
            this.deselectAllNodes();
            this.updateConnections();
        }
    }
    
    updateConnections() {
        // Remove existing connection lines
        document.querySelectorAll('.connection-line').forEach(line => line.remove());
        
        // For demo purposes, connect nodes in sequence
        const nodeElements = Array.from(document.querySelectorAll('.workflow-node'));
        nodeElements.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            return rectA.left - rectB.left;
        });
        
        for (let i = 0; i < nodeElements.length - 1; i++) {
            this.createConnection(nodeElements[i], nodeElements[i + 1]);
        }
    }
    
    createConnection(fromNode, toNode) {
        const fromRect = fromNode.getBoundingClientRect();
        const toRect = toNode.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const fromX = fromRect.right - canvasRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - canvasRect.top;
        const toX = toRect.left - canvasRect.left;
        const toY = toRect.top + toRect.height / 2 - canvasRect.top;
        
        const line = document.createElement('div');
        line.className = 'connection-line';
        
        const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
        const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
        
        line.style.width = length + 'px';
        line.style.left = fromX + 'px';
        line.style.top = fromY + 'px';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.transformOrigin = '0 50%';
        
        this.workflowContainer.appendChild(line);
    }
    
    createSampleWorkflow() {
        // Create a sample workflow to demonstrate functionality
        setTimeout(() => {
            const sourceNode = this.createNode('source', '📊', 'CSV Input', 50, 100);
            const transformNode = this.createNode('transform', '⚙️', 'Transform', 250, 100);
            const sinkNode = this.createNode('sink', '💾', 'Output', 450, 100);
            
            setTimeout(() => {
                this.updateConnections();
            }, 100);
        }, 500);
    }
    
    clearCanvas() {
        this.workflowContainer.innerHTML = '';
        this.nodes.clear();
        this.connections = [];
        this.selectedNode = null;
        this.nodeCounter = 0;
        this.showProperties(null);
    }
    
    exportWorkflow() {
        const workflow = this.generateWorkflowXML();
        document.getElementById('xml-output').textContent = workflow;
        document.getElementById('export-modal').classList.remove('hidden');
        document.getElementById('export-modal').classList.add('flex');
    }
    
    generateWorkflowXML() {
        const nodes = Array.from(this.nodes.values());
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<workflow xmlns="http://sigilweaver.com/schema/workflow" version="1.0">
    <metadata>
        <title>Untitled Workflow</title>
        <description>Generated from Sigilweaver Demo</description>
        <created>${new Date().toISOString()}</created>
        <author>Demo User</author>
    </metadata>
    
    <nodes>`;
        
        nodes.forEach(node => {
            xml += `
        <node id="${node.id}" type="${node.type}">
            <position x="${Math.round(node.x)}" y="${Math.round(node.y)}" />
            <properties>`;
            
            for (const [key, value] of Object.entries(node.properties)) {
                xml += `
                <property name="${key}" value="${this.escapeXML(value)}" />`;
            }
            
            xml += `
            </properties>
        </node>`;
        });
        
        xml += `
    </nodes>
    
    <connections>`;
        
        // Generate connections based on node positions (simplified for demo)
        const sortedNodes = nodes.sort((a, b) => a.x - b.x);
        for (let i = 0; i < sortedNodes.length - 1; i++) {
            xml += `
        <connection from="${sortedNodes[i].id}" to="${sortedNodes[i + 1].id}" />`;
        }
        
        xml += `
    </connections>
</workflow>`;
        
        return xml;
    }
    
    escapeXML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    closeModal() {
        document.getElementById('export-modal').classList.add('hidden');
        document.getElementById('export-modal').classList.remove('flex');
    }
    
    async copyXML() {
        const xml = document.getElementById('xml-output').textContent;
        try {
            await navigator.clipboard.writeText(xml);
            const button = document.getElementById('copy-xml');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.classList.add('bg-green-600');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('bg-green-600');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
    
    downloadXML() {
        const xml = document.getElementById('xml-output').textContent;
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sigilweaver-workflow.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize demo when page loads
let demo;
document.addEventListener('DOMContentLoaded', () => {
    demo = new SigilweaverDemo();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (demo) {
        demo.updateConnections();
    }
});

// Prevent default drag behavior on images and other elements
document.addEventListener('dragstart', (e) => {
    if (!e.target.classList.contains('node-template')) {
        e.preventDefault();
    }
});

// Add some helpful keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && demo && demo.selectedNode) {
        const nodeId = demo.selectedNode.dataset.nodeId;
        demo.deleteNode(nodeId);
    } else if (e.key === 'Escape') {
        if (demo) {
            demo.deselectAllNodes();
        }
    }
});
