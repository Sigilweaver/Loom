import { describe, test, expect, vi, beforeEach } from 'vitest';
import { XMLWorkflowManager } from '../XMLWorkflowManager';
import type { Tool, ToolConfig } from '../../domain/workflow/entities/workflow';

// Mock uuid to get predictable IDs in tests
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

// Mock package.json version
vi.mock('../../../package.json', () => ({
  default: { version: '1.0.0' }
}));

describe('XMLWorkflowManager - Tool Management', () => {
  let manager: XMLWorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new XMLWorkflowManager();
  });

  describe('getTools()', () => {
    test('returns empty array for new workflow', () => {
      const tools = manager.getTools();
      expect(tools).toEqual([]);
      expect(Array.isArray(tools)).toBe(true);
    });

    test('returns tools from loaded XML', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="tool1" type="Input" x="100" y="200">
        <Config>
          <field1>value1</field1>
          <field2>value2</field2>
        </Config>
        <Sockets>
          <Socket id="1" direction="output" type="data" multiple="false"/>
        </Sockets>
      </Tool>
      <Tool id="tool2" type="Output" x="300" y="400">
        <Config>
          <outputPath>/path/to/output</outputPath>
        </Config>
        <Sockets>
          <Socket id="1" direction="input" type="data" multiple="false"/>
        </Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const tools = manager.getTools();

      expect(tools).toHaveLength(2);
      
      const tool1 = tools.find(t => t.id === 'tool1');
      expect(tool1).toBeDefined();
      expect(tool1!.x).toBe(100);
      expect(tool1!.y).toBe(200);
      expect(tool1!.type).toBe('Input');
      expect(tool1!.config).toEqual({ field1: 'value1', field2: 'value2' });
      expect(tool1!.sockets).toHaveLength(1);
      expect(tool1!.sockets[0]).toEqual({
        id: 1,
        direction: 'output',
        type: 'data',
        multiple: false
      });

      const tool2 = tools.find(t => t.id === 'tool2');
      expect(tool2).toBeDefined();
      expect(tool2!.x).toBe(300);
      expect(tool2!.y).toBe(400);
      expect(tool2!.type).toBe('Output');
      expect(tool2!.config).toEqual({ outputPath: '/path/to/output' });
      expect(tool2!.sockets).toHaveLength(1);
      expect(tool2!.sockets[0]).toEqual({
        id: 1,
        direction: 'input',
        type: 'data',
        multiple: false
      });
    });

    test('handles tools with missing optional attributes', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="minimal-tool" type="Transform">
        <Sockets></Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const tools = manager.getTools();

      expect(tools).toHaveLength(1);
      const tool = tools[0]!;
      expect(tool.id).toBe('minimal-tool');
      expect(tool.x).toBe(0); // Default values
      expect(tool.y).toBe(0);
      expect(tool.type).toBe('Transform');
      expect(tool.config).toEqual({});
      expect(tool.sockets).toEqual([]);
    });

    test('handles tools with empty configuration', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="no-config-tool" type="Filter">
        <Config></Config>
        <Sockets></Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const tools = manager.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]!.config).toEqual({});
    });

    test('skips tools without required id or type attributes', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="valid-tool" type="Input">
        <Sockets></Sockets>
      </Tool>
      <Tool type="NoId">
        <Sockets></Sockets>
      </Tool>
      <Tool id="no-type">
        <Sockets></Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const tools = manager.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]!.id).toBe('valid-tool');
    });
  });

  describe('addTool()', () => {
    test('adds new tool with all properties', () => {
      const newTool: Tool = {
        id: 'new-tool-123',
        type: 'Processing',
        x: 150,
        y: 250,
        config: {
          param1: 'value1',
          param2: 42,
          param3: true
        },
        sockets: [
          { id: 1, direction: 'input', type: 'data', multiple: false },
          { id: 2, direction: 'output', type: 'data', multiple: false }
        ]
      };

      manager.addTool(newTool);

      const tools = manager.getTools();
      expect(tools).toHaveLength(1);
      
      const addedTool = tools[0]!;
      expect(addedTool.id).toBe(newTool.id);
      expect(addedTool.type).toBe(newTool.type);
      expect(addedTool.x).toBe(newTool.x);
      expect(addedTool.y).toBe(newTool.y);
      expect(addedTool.sockets).toEqual(newTool.sockets);
      // Config values get converted to strings in XML
      expect(addedTool.config).toEqual({
        param1: 'value1',
        param2: '42',
        param3: 'true'
      });
    });

    test('adds tool with minimal properties', () => {
      const minimalTool: Tool = {
        id: 'minimal-123',
        type: 'Input',
        x: 0,
        y: 0,
        config: {},
        sockets: []
      };

      manager.addTool(minimalTool);

      const tools = manager.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual(minimalTool);
    });

    test('adds multiple tools', () => {
      const tool1: Tool = {
        id: 'tool-1',
        type: 'Input',
        x: 100,
        y: 100,
        config: {},
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };

      const tool2: Tool = {
        id: 'tool-2',
        type: 'Output',
        x: 300,
        y: 200,
        config: {},
        sockets: [{ id: 1, direction: 'input', multiple: false }]
      };

      manager.addTool(tool1);
      manager.addTool(tool2);

      const tools = manager.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.find(t => t.id === 'tool-1')).toEqual(tool1);
      expect(tools.find(t => t.id === 'tool-2')).toEqual(tool2);
    });

    test('preserves existing tools when adding new ones', () => {
      // Start with a workflow that has existing tools
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="existing-tool" type="Existing" x="50" y="50">
        <Sockets></Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      
      const newTool: Tool = {
        id: 'new-tool',
        type: 'New',
        x: 200,
        y: 200,
        config: {},
        sockets: []
      };

      manager.addTool(newTool);

      const tools = manager.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.find(t => t.id === 'existing-tool')).toBeDefined();
      expect(tools.find(t => t.id === 'new-tool')).toEqual(newTool);
    });

    test('handles complex configuration objects', () => {
      const complexTool: Tool = {
        id: 'complex-tool',
        type: 'Complex',
        x: 100,
        y: 100,
        config: {
          stringField: 'test string',
          numberField: 123.45,
          booleanField: true
        },
        sockets: []
      };

      manager.addTool(complexTool);

      const tools = manager.getTools();
      // Note: Config values get converted to strings in XML
      expect(tools[0]!.config).toEqual({
        stringField: 'test string',
        numberField: '123.45',
        booleanField: 'true'
      });
    });

    test('creates proper XML structure', () => {
      const tool: Tool = {
        id: 'xml-test-tool',
        type: 'XMLTest',
        x: 123,
        y: 456,
        config: { field: 'value' },
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };

      manager.addTool(tool);

      const xml = manager.toXMLString();
      expect(xml).toContain('id="xml-test-tool"');
      expect(xml).toContain('type="XMLTest"');
      expect(xml).toContain('x="123"');
      expect(xml).toContain('y="456"');
      expect(xml).toContain('<Config>');
      expect(xml).toContain('<field>value</field>');
      expect(xml).toContain('<Sockets>');
      expect(xml).toContain('direction="output"');
    });
  });

  describe('removeTool()', () => {
    beforeEach(() => {
      // Add some tools to work with
      const tool1: Tool = {
        id: 'tool-1',
        type: 'Input',
        x: 100,
        y: 100,
        config: {},
        sockets: []
      };

      const tool2: Tool = {
        id: 'tool-2',
        type: 'Output',
        x: 300,
        y: 200,
        config: {},
        sockets: []
      };

      manager.addTool(tool1);
      manager.addTool(tool2);
    });

    test('removes existing tool', () => {
      expect(manager.getTools()).toHaveLength(2);

      manager.removeTool('tool-1');

      const tools = manager.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]!.id).toBe('tool-2');
    });

    test('does nothing when removing non-existent tool', () => {
      expect(manager.getTools()).toHaveLength(2);

      manager.removeTool('non-existent-tool');

      expect(manager.getTools()).toHaveLength(2);
    });

    test('removes all tools when called multiple times', () => {
      manager.removeTool('tool-1');
      manager.removeTool('tool-2');

      expect(manager.getTools()).toHaveLength(0);
    });

    test('handles removing tool from empty workflow', () => {
      const emptyManager = new XMLWorkflowManager();
      expect(() => {
        emptyManager.removeTool('any-tool');
      }).not.toThrow();
      
      expect(emptyManager.getTools()).toHaveLength(0);
    });

    test('removes tool from XML structure', () => {
      manager.removeTool('tool-1');

      const xml = manager.toXMLString();
      expect(xml).not.toContain('id="tool-1"');
      expect(xml).toContain('id="tool-2"');
    });
  });

  describe('updateToolPosition()', () => {
    let testTool: Tool;

    beforeEach(() => {
      testTool = {
        id: 'position-test-tool',
        type: 'Test',
        x: 100,
        y: 200,
        config: {},
        sockets: []
      };
      manager.addTool(testTool);
    });

    test('updates tool position', () => {
      manager.updateToolPosition('position-test-tool', 300, 400);

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'position-test-tool');
      
      expect(updatedTool!.x).toBe(300);
      expect(updatedTool!.y).toBe(400);
      // Other properties should remain unchanged
      expect(updatedTool!.type).toBe('Test');
    });

    test('handles negative coordinates', () => {
      manager.updateToolPosition('position-test-tool', -50, -100);

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'position-test-tool');
      
      expect(updatedTool!.x).toBe(-50);
      expect(updatedTool!.y).toBe(-100);
    });

    test('handles fractional coordinates', () => {
      manager.updateToolPosition('position-test-tool', 123.45, 678.9);

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'position-test-tool');
      
      expect(updatedTool!.x).toBe(123.45);
      expect(updatedTool!.y).toBe(678.9);
    });

    test('does nothing for non-existent tool', () => {
      const originalTools = manager.getTools();
      
      manager.updateToolPosition('non-existent-tool', 500, 600);
      
      const updatedTools = manager.getTools();
      expect(updatedTools).toEqual(originalTools);
    });

    test('updates position in XML structure', () => {
      manager.updateToolPosition('position-test-tool', 777, 888);

      const xml = manager.toXMLString();
      expect(xml).toContain('x="777"');
      expect(xml).toContain('y="888"');
    });
  });

  describe('updateToolConfiguration()', () => {
    let testTool: Tool;

    beforeEach(() => {
      testTool = {
        id: 'config-test-tool',
        type: 'Test',
        x: 100,
        y: 200,
        config: {
          existingField: 'existing value',
          numberField: 42
        },
        sockets: []
      };
      manager.addTool(testTool);
    });

    test('updates tool configuration', () => {
      const newConfig: ToolConfig = {
        newField: 'new value',
        anotherField: 123
      };

      manager.updateToolConfiguration('config-test-tool', newConfig);

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'config-test-tool');
      
      // Config values are stored as strings in XML
      expect(updatedTool!.config).toEqual({
        newField: 'new value',
        anotherField: '123'
      });
      // Other properties should remain unchanged
      expect(updatedTool!.x).toBe(100);
      expect(updatedTool!.y).toBe(200);
      expect(updatedTool!.type).toBe('Test');
    });

    test('replaces entire configuration', () => {
      const newConfig: ToolConfig = { completelyNew: 'configuration' };

      manager.updateToolConfiguration('config-test-tool', newConfig);

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'config-test-tool');
      
      expect(updatedTool!.config).toEqual({ completelyNew: 'configuration' });
      expect(updatedTool!.config).not.toHaveProperty('existingField');
    });

    test('handles empty configuration', () => {
      manager.updateToolConfiguration('config-test-tool', {});

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'config-test-tool');
      
      expect(updatedTool!.config).toEqual({});
    });

    test('handles configuration with various data types', () => {
      const complexConfig: ToolConfig = {
        string: 'text value',
        number: 123.45,
        boolean: true
      };

      manager.updateToolConfiguration('config-test-tool', complexConfig);

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'config-test-tool');
      
      // All values get converted to strings in XML
      expect(updatedTool!.config).toEqual({
        string: 'text value',
        number: '123.45',
        boolean: 'true'
      });
    });

    test('does nothing for non-existent tool', () => {
      const originalTools = manager.getTools();
      
      manager.updateToolConfiguration('non-existent-tool', { field: 'value' });
      
      const updatedTools = manager.getTools();
      expect(updatedTools).toEqual(originalTools);
    });

    test('persists configuration changes in XML', () => {
      manager.updateToolConfiguration('config-test-tool', { 
        xmlField: 'xml value',
        specialChars: '<>&"\''
      });

      const xml = manager.toXMLString();
      expect(xml).toContain('<xmlField>xml value</xmlField>');
      // Special characters should be properly escaped
      expect(xml).toContain('&lt;');
      expect(xml).toContain('&amp;');
    });

    test('removes existing config section when updating', () => {
      // First update
      manager.updateToolConfiguration('config-test-tool', { first: 'update' });
      
      // Second update should completely replace
      manager.updateToolConfiguration('config-test-tool', { second: 'update' });

      const tools = manager.getTools();
      const updatedTool = tools.find(t => t.id === 'config-test-tool');
      
      expect(updatedTool!.config).toEqual({ second: 'update' });
      expect(updatedTool!.config).not.toHaveProperty('first');
    });
  });

  describe('Tool management integration', () => {
    test('tool operations work together correctly', () => {
      // Add a tool
      const tool: Tool = {
        id: 'integration-tool',
        type: 'Test',
        x: 100,
        y: 200,
        config: { initial: 'config' },
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };
      
      manager.addTool(tool);
      expect(manager.getTools()).toHaveLength(1);

      // Update position
      manager.updateToolPosition('integration-tool', 300, 400);
      
      // Update configuration
      manager.updateToolConfiguration('integration-tool', { updated: 'config' });

      // Verify all changes
      const tools = manager.getTools();
      const updatedTool = tools[0]!;
      
      expect(updatedTool.id).toBe('integration-tool');
      expect(updatedTool.x).toBe(300);
      expect(updatedTool.y).toBe(400);
      expect(updatedTool.config).toEqual({ updated: 'config' });
      expect(updatedTool.type).toBe('Test'); // Unchanged
      expect(updatedTool.sockets).toEqual([{ id: 1, direction: 'output', multiple: false }]); // Unchanged

      // Remove tool
      manager.removeTool('integration-tool');
      expect(manager.getTools()).toHaveLength(0);
    });

    test('tool operations survive XML round-trip', () => {
      const tool: Tool = {
        id: 'roundtrip-tool',
        type: 'RoundTrip',
        x: 123,
        y: 456,
        config: { 
          field1: 'value1',
          field2: 789
        },
        sockets: [
          { id: 1, direction: 'input', type: 'data', multiple: false },
          { id: 2, direction: 'output', type: 'data', multiple: true }
        ]
      };

      manager.addTool(tool);
      const xml = manager.toXMLString();

      // Create new manager from XML
      const newManager = new XMLWorkflowManager(xml);
      const tools = newManager.getTools();

      expect(tools).toHaveLength(1);
      const roundTripTool = tools[0]!;
      
      expect(roundTripTool.id).toBe('roundtrip-tool');
      expect(roundTripTool.type).toBe('RoundTrip');
      expect(roundTripTool.x).toBe(123);
      expect(roundTripTool.y).toBe(456);
      expect(roundTripTool.config).toEqual({ 
        field1: 'value1',
        field2: '789' // Numbers become strings
      });
      expect(roundTripTool.sockets).toEqual([
        { id: 1, direction: 'input', type: 'data', multiple: false },
        { id: 2, direction: 'output', type: 'data', multiple: true }
      ]);
    });
  });
});
