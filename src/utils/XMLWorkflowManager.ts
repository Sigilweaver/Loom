import { Tool, Wire, WorkflowMeta, ToolConfig } from '../domain/workflow/entities/workflow';
// Use the frontend's package.json version for XML <Workflow version="...">
import pkg from '../../package.json';
import { v4 as uuidv4 } from 'uuid';

export class XMLWorkflowManager {
  private document: Document;

  constructor(xmlString?: string) {
    if (xmlString) {
      this.document = this.parseXML(xmlString);
    } else {
      this.document = this.createNewWorkflow();
    }
  }

  // Parse XML with security protections
  private parseXML(xmlString: string): Document {
    // Basic sanitization - remove dangerous patterns
    const sanitized = this.sanitizeXML(xmlString);
    
    const doc = new DOMParser().parseFromString(sanitized, 'text/xml');
    
    // Check for parsing errors
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      throw new Error('Invalid XML format');
    }
    
    return doc;
  }

  // Basic XML sanitization to prevent XXE and other attacks
  private sanitizeXML(xmlString: string): string {
    // Remove XML external entity declarations (XXE prevention)
    const sanitized = xmlString
      // Remove DOCTYPE declarations (main XXE vector)
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      // Remove XML entity references (except safe built-ins)
      .replace(/&(?!amp;|lt;|gt;|quot;|apos;)[^;]+;/g, '')
      // Remove processing instructions (except XML declaration)
      .replace(/<\?(?!xml\s)[^>]*\?>/gi, '');
      // Note: Keeping CDATA sections as they're used legitimately in workflow descriptions
    
    return sanitized;
  }

  private createNewWorkflow(): Document {
  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="${pkg.version}" xmlns="https://docs.sigilweaver.com/schema/workflow">
  <Meta>
    <n>New Workflow</n>
    <Description>
      <![CDATA[
      A new workflow
      ]]>
    </Description>
    <Author>Workflow Designer</Author>
    <WorkflowId>${uuidv4()}</WorkflowId>
    <Created>${new Date().toISOString()}</Created>
  </Meta>
  
  <Layout>
    <Container id="root" name="Root Container" x="0" y="0" width="1200" height="800">
    </Container>
  </Layout>
  
  <Wires>
  </Wires>
</Workflow>`;
    
    return new DOMParser().parseFromString(xmlString, 'text/xml');
  }

  // Export the entire XML document as string
  toXMLString(): string {
    // Ensure the root <Workflow> element has the current frontend version
    const root = this.document.querySelector('Workflow');
    if (root) {
      root.setAttribute('version', pkg.version);
    }
    return new XMLSerializer().serializeToString(this.document);
  }

  // Get workflow metadata
  getMetadata(): WorkflowMeta {
    const metaEl = this.document.querySelector('Meta');
    if (!metaEl) throw new Error('Invalid workflow: Missing Meta section');

    return {
      name: metaEl.querySelector('n')?.textContent || 'Untitled Workflow',
      description: metaEl.querySelector('Description')?.textContent?.trim() || '',
      author: metaEl.querySelector('Author')?.textContent || 'Unknown',
      workflowId: metaEl.querySelector('WorkflowId')?.textContent || uuidv4(),
      created: metaEl.querySelector('Created')?.textContent || new Date().toISOString(),
    };
  }

  // Update workflow metadata
  updateMetadata(meta: Partial<WorkflowMeta>): void {
    const metaEl = this.document.querySelector('Meta');
    if (!metaEl) throw new Error('Invalid workflow: Missing Meta section');

    if (meta.name !== undefined) {
      const nameEl = metaEl.querySelector('n');
      if (nameEl) nameEl.textContent = meta.name;
    }

    if (meta.description !== undefined) {
      const descEl = metaEl.querySelector('Description');
      if (descEl) descEl.textContent = `\n      ${meta.description}\n      `;
    }

    if (meta.author !== undefined) {
      const authorEl = metaEl.querySelector('Author');
      if (authorEl) authorEl.textContent = meta.author;
    }
  }

  // Get all tools from XML
  getTools(): Tool[] {
    const tools: Tool[] = [];
    const toolElements = this.document.querySelectorAll('Container Tool');

    toolElements.forEach(toolEl => {
      const id = toolEl.getAttribute('id');
      const type = toolEl.getAttribute('type');
      const x = parseFloat(toolEl.getAttribute('x') || '0');
      const y = parseFloat(toolEl.getAttribute('y') || '0');

      if (!id || !type) return;

      // Parse config
      const config: ToolConfig = {};
      const configEl = toolEl.querySelector('Config');
      if (configEl) {
        Array.from(configEl.children).forEach(child => {
          config[child.tagName] = child.textContent;
        });
      }

      // Parse sockets
  const sockets = Array.from(toolEl.querySelectorAll('Sockets Socket')).map(socketEl => {
        const idAttr = socketEl.getAttribute('id');
        const dirAttr = socketEl.getAttribute('direction') as 'input' | 'output' | null;
        if (!idAttr || !dirAttr) return null;
        const sockType = socketEl.getAttribute('type');
        return {
          id: parseInt(idAttr),
          direction: dirAttr,
          ...(sockType ? { type: sockType } : {}),
          multiple: socketEl.getAttribute('multiple') === 'true'
        };
  }).filter((s): s is { id: number; direction: 'input' | 'output'; type?: string; multiple: boolean } => s !== null);

      tools.push({ id, type, x, y, config, sockets });
    });

    return tools;
  }

  // Add a new tool to XML
  addTool(tool: Tool): void {
    const containerEl = this.document.querySelector('Container');
    if (!containerEl) throw new Error('Invalid workflow: Missing Container');

    const toolEl = this.document.createElement('Tool');
    toolEl.setAttribute('id', tool.id);
    toolEl.setAttribute('type', tool.type);
    toolEl.setAttribute('x', tool.x.toString());
    toolEl.setAttribute('y', tool.y.toString());

    // Add config section
    if (Object.keys(tool.config).length > 0) {
      const configEl = this.document.createElement('Config');
      Object.entries(tool.config).forEach(([key, value]) => {
        const configItem = this.document.createElement(key);
        configItem.textContent = String(value);
        configEl.appendChild(configItem);
      });
      toolEl.appendChild(configEl);
    }

    // Add sockets section
    const socketsEl = this.document.createElement('Sockets');
    tool.sockets.forEach(socket => {
      const socketEl = this.document.createElement('Socket');
      socketEl.setAttribute('id', socket.id.toString());
      socketEl.setAttribute('direction', socket.direction);
      if (socket.type) socketEl.setAttribute('type', socket.type);
      if (socket.multiple) socketEl.setAttribute('multiple', 'true');
      socketsEl.appendChild(socketEl);
    });
    toolEl.appendChild(socketsEl);

    containerEl.appendChild(toolEl);
  }

  // Remove a tool from XML
  removeTool(toolId: string): void {
    const toolEl = this.document.querySelector(`Tool[id="${toolId}"]`);
    if (toolEl) {
      toolEl.remove();
    }

    // Also remove any wires connected to this tool
    this.removeWiresByTool(toolId);
  }

  // Update tool position
  updateToolPosition(toolId: string, x: number, y: number): void {
    const toolEl = this.document.querySelector(`Tool[id="${toolId}"]`);
    if (toolEl) {
      toolEl.setAttribute('x', x.toString());
      toolEl.setAttribute('y', y.toString());
    }
  }

  // Update tool configuration
  updateToolConfiguration(toolId: string, configuration: ToolConfig): void {
    const toolEl = this.document.querySelector(`Tool[id="${toolId}"]`);
    if (!toolEl) return;

    // Remove existing config section
    const existingConfigEl = toolEl.querySelector('Config');
    if (existingConfigEl) {
      existingConfigEl.remove();
    }

    // Create new config section with ordered fields
    if (Object.keys(configuration).length > 0) {
      const configEl = this.document.createElement('Config');
      
      // Define a specific order for configuration fields (Category and Type first, then common input tool fields)
      const fieldOrder = [
        'Category', 'Type',  // Backend processing identifiers
        'filePath', 'path', 'fileName', 'file',
        'delimiter', 'customDelimiter', 'hasHeaders', 
        'startLine', 'startRow', 'encoding', 'quoteHandling',
        'recordLimit', 'continueOnError'
      ];
      
      // Add ordered fields first
      fieldOrder.forEach(fieldName => {
        if (configuration[fieldName] !== undefined && configuration[fieldName] !== null) {
          const configItem = this.document.createElement(fieldName);
          configItem.textContent = String(configuration[fieldName]);
          configEl.appendChild(configItem);
        }
      });
      
      // Add any remaining fields that weren't in the ordered list
      Object.entries(configuration).forEach(([key, value]) => {
        if (!fieldOrder.includes(key) && value !== undefined && value !== null) {
          const configItem = this.document.createElement(key);
          configItem.textContent = String(value);
          configEl.appendChild(configItem);
        }
      });
      
      toolEl.appendChild(configEl);
    }
  }

  // Get all wires from XML
  getWires(): Wire[] {
    const wires: Wire[] = [];
    const wireElements = this.document.querySelectorAll('Wires Wire');

    wireElements.forEach(wireEl => {
      const fromEl = wireEl.querySelector('From');
      const toEl = wireEl.querySelector('To');

      if (fromEl && toEl) {
        const fromTool = fromEl.getAttribute('tool');
        const fromSocket = fromEl.getAttribute('socket');
        const toTool = toEl.getAttribute('tool');
        const toSocket = toEl.getAttribute('socket');

        if (fromTool && fromSocket && toTool && toSocket) {
          wires.push({
            from: { tool: fromTool, socket: parseInt(fromSocket) },
            to: { tool: toTool, socket: parseInt(toSocket) },
          });
        }
      }
    });

    return wires;
  }

  // Add a wire to XML
  addWire(wire: Wire): void {
    const wiresEl = this.document.querySelector('Wires');
    if (!wiresEl) throw new Error('Invalid workflow: Missing Wires section');

    const wireEl = this.document.createElement('Wire');
    
    const fromEl = this.document.createElement('From');
    fromEl.setAttribute('tool', wire.from.tool);
    fromEl.setAttribute('socket', wire.from.socket.toString());
    
    const toEl = this.document.createElement('To');
    toEl.setAttribute('tool', wire.to.tool);
    toEl.setAttribute('socket', wire.to.socket.toString());
    
    wireEl.appendChild(fromEl);
    wireEl.appendChild(toEl);
    wiresEl.appendChild(wireEl);
  }

  // Remove a specific wire
  removeWire(from: { tool: string; socket: number }, to: { tool: string; socket: number }): void {
    const wireElements = this.document.querySelectorAll('Wires Wire');
    
    wireElements.forEach(wireEl => {
      const fromEl = wireEl.querySelector('From');
      const toEl = wireEl.querySelector('To');
      
      if (fromEl && toEl) {
        const wireFrom = {
          tool: fromEl.getAttribute('tool') || '',
          socket: parseInt(fromEl.getAttribute('socket') || '0'),
        };
        const wireTo = {
          tool: toEl.getAttribute('tool') || '',
          socket: parseInt(toEl.getAttribute('socket') || '0'),
        };
        
        if (wireFrom.tool === from.tool && wireFrom.socket === from.socket &&
            wireTo.tool === to.tool && wireTo.socket === to.socket) {
          wireEl.remove();
        }
      }
    });
  }

  // Remove all wires connected to a specific tool
  private removeWiresByTool(toolId: string): void {
    const wireElements = this.document.querySelectorAll('Wires Wire');
    
    wireElements.forEach(wireEl => {
      const fromEl = wireEl.querySelector('From');
      const toEl = wireEl.querySelector('To');
      
      if ((fromEl && fromEl.getAttribute('tool') === toolId) ||
          (toEl && toEl.getAttribute('tool') === toolId)) {
        wireEl.remove();
      }
    });
  }

  // Clear all tools and wires
  clear(): void {
    const containerEl = this.document.querySelector('Container');
    if (containerEl) {
      // Remove all tools
      const tools = containerEl.querySelectorAll('Tool');
      tools.forEach(tool => tool.remove());
    }

    const wiresEl = this.document.querySelector('Wires');
    if (wiresEl) {
      // Remove all wires
      const wires = wiresEl.querySelectorAll('Wire');
      wires.forEach(wire => wire.remove());
    }
  }

  // Create a new workflow with default metadata
  newWorkflow(): void {
    this.document = this.createNewWorkflow();
  }

  // Load workflow from XML string
  loadFromXML(xmlString: string): void {
    const newDoc = this.parseXML(xmlString);
    
    // Validate basic structure
    if (!newDoc.querySelector('Workflow')) {
      throw new Error('Invalid workflow format: Missing Workflow root element');
    }
    
    this.document = newDoc;
  }
}
