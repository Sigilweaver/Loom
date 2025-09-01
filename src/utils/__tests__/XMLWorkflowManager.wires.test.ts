import { describe, test, expect, vi, beforeEach } from 'vitest';
import { XMLWorkflowManager } from '../XMLWorkflowManager';
import type { Wire, Tool } from '../../domain/workflow/entities/workflow';

// Mock uuid to get predictable IDs in tests
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

// Mock package.json version
vi.mock('../../../package.json', () => ({
  default: { version: '1.0.0' }
}));

describe('XMLWorkflowManager - Wire Management', () => {
  let manager: XMLWorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new XMLWorkflowManager();
    
    // Add some tools to work with
    const inputTool: Tool = {
      id: 'input-tool',
      type: 'Input',
      x: 100,
      y: 100,
      config: {},
      sockets: [
        { id: 1, direction: 'output', type: 'data', multiple: false }
      ]
    };

    const processTool: Tool = {
      id: 'process-tool',
      type: 'Process',
      x: 300,
      y: 200,
      config: {},
      sockets: [
        { id: 1, direction: 'input', type: 'data', multiple: false },
        { id: 2, direction: 'output', type: 'data', multiple: false }
      ]
    };

    const outputTool: Tool = {
      id: 'output-tool',
      type: 'Output',
      x: 500,
      y: 100,
      config: {},
      sockets: [
        { id: 1, direction: 'input', type: 'data', multiple: false }
      ]
    };

    manager.addTool(inputTool);
    manager.addTool(processTool);
    manager.addTool(outputTool);
  });

  describe('getWires()', () => {
    test('returns empty array for workflow with no wires', () => {
      const wires = manager.getWires();
      expect(wires).toEqual([]);
      expect(Array.isArray(wires)).toBe(true);
    });

    test('returns wires from loaded XML', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="tool1" type="Input" x="100" y="100">
        <Sockets>
          <Socket id="1" direction="output" type="data" multiple="false"/>
        </Sockets>
      </Tool>
      <Tool id="tool2" type="Output" x="300" y="200">
        <Sockets>
          <Socket id="1" direction="input" type="data" multiple="false"/>
        </Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires>
    <Wire>
      <From tool="tool1" socket="1"/>
      <To tool="tool2" socket="1"/>
    </Wire>
  </Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const wires = manager.getWires();

      expect(wires).toHaveLength(1);
      expect(wires[0]).toEqual({
        from: { tool: 'tool1', socket: 1 },
        to: { tool: 'tool2', socket: 1 }
      });
    });

    test('returns multiple wires from XML', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="input" type="Input" x="100" y="100">
        <Sockets>
          <Socket id="1" direction="output" type="data" multiple="false"/>
        </Sockets>
      </Tool>
      <Tool id="process" type="Process" x="300" y="200">
        <Sockets>
          <Socket id="1" direction="input" type="data" multiple="false"/>
          <Socket id="2" direction="output" type="data" multiple="false"/>
        </Sockets>
      </Tool>
      <Tool id="output" type="Output" x="500" y="100">
        <Sockets>
          <Socket id="1" direction="input" type="data" multiple="false"/>
        </Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires>
    <Wire>
      <From tool="input" socket="1"/>
      <To tool="process" socket="1"/>
    </Wire>
    <Wire>
      <From tool="process" socket="2"/>
      <To tool="output" socket="1"/>
    </Wire>
  </Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const wires = manager.getWires();

      expect(wires).toHaveLength(2);
      expect(wires).toContainEqual({
        from: { tool: 'input', socket: 1 },
        to: { tool: 'process', socket: 1 }
      });
      expect(wires).toContainEqual({
        from: { tool: 'process', socket: 2 },
        to: { tool: 'output', socket: 1 }
      });
    });

    test('skips malformed wire elements', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires>
    <Wire>
      <From tool="tool1" socket="1"/>
      <To tool="tool2" socket="1"/>
    </Wire>
    <Wire>
      <!-- Missing From element -->
      <To tool="tool3" socket="1"/>
    </Wire>
    <Wire>
      <From tool="tool4" socket="1"/>
      <!-- Missing To element -->
    </Wire>
    <Wire>
      <!-- Missing socket attribute -->
      <From tool="tool5"/>
      <To tool="tool6" socket="1"/>
    </Wire>
  </Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const wires = manager.getWires();

      expect(wires).toHaveLength(1);
      expect(wires[0]).toEqual({
        from: { tool: 'tool1', socket: 1 },
        to: { tool: 'tool2', socket: 1 }
      });
    });

    test('handles empty Wires section', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const wires = manager.getWires();

      expect(wires).toEqual([]);
    });
  });

  describe('addWire()', () => {
    test('adds a single wire', () => {
      const wire: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };

      manager.addWire(wire);

      const wires = manager.getWires();
      expect(wires).toHaveLength(1);
      expect(wires[0]).toEqual(wire);
    });

    test('adds multiple wires', () => {
      const wire1: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };

      const wire2: Wire = {
        from: { tool: 'process-tool', socket: 2 },
        to: { tool: 'output-tool', socket: 1 }
      };

      manager.addWire(wire1);
      manager.addWire(wire2);

      const wires = manager.getWires();
      expect(wires).toHaveLength(2);
      expect(wires).toContainEqual(wire1);
      expect(wires).toContainEqual(wire2);
    });

    test('allows duplicate wires', () => {
      const wire: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };

      manager.addWire(wire);
      manager.addWire(wire); // Add same wire again

      const wires = manager.getWires();
      expect(wires).toHaveLength(2);
      expect(wires[0]).toEqual(wire);
      expect(wires[1]).toEqual(wire);
    });

    test('preserves existing wires when adding new ones', () => {
      // Start with a workflow that has existing wires
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root">
      <Tool id="existing1" type="Input" x="100" y="100">
        <Sockets></Sockets>
      </Tool>
      <Tool id="existing2" type="Output" x="300" y="200">
        <Sockets></Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires>
    <Wire>
      <From tool="existing1" socket="1"/>
      <To tool="existing2" socket="1"/>
    </Wire>
  </Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      expect(manager.getWires()).toHaveLength(1);

      const newWire: Wire = {
        from: { tool: 'existing2', socket: 2 },
        to: { tool: 'existing1', socket: 2 }
      };

      manager.addWire(newWire);

      const wires = manager.getWires();
      expect(wires).toHaveLength(2);
      expect(wires).toContainEqual({
        from: { tool: 'existing1', socket: 1 },
        to: { tool: 'existing2', socket: 1 }
      });
      expect(wires).toContainEqual(newWire);
    });

    test('creates proper XML structure', () => {
      const wire: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'output-tool', socket: 1 }
      };

      manager.addWire(wire);

      const xml = manager.toXMLString();
      expect(xml).toContain('<Wires>');
      expect(xml).toContain('<Wire');
      expect(xml).toContain('tool="input-tool"');
      expect(xml).toContain('socket="1"');
      expect(xml).toContain('tool="output-tool"');
      expect(xml).toContain('</Wires>');
    });

    test('handles high socket numbers', () => {
      const wire: Wire = {
        from: { tool: 'input-tool', socket: 999 },
        to: { tool: 'output-tool', socket: 1000 }
      };

      manager.addWire(wire);

      const wires = manager.getWires();
      expect(wires[0]).toEqual(wire);

      const xml = manager.toXMLString();
      expect(xml).toContain('socket="999"');
      expect(xml).toContain('socket="1000"');
    });

    test('throws error if Wires section is missing', () => {
      // Create a malformed workflow without Wires section
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);

      const wire: Wire = {
        from: { tool: 'tool1', socket: 1 },
        to: { tool: 'tool2', socket: 1 }
      };

      expect(() => {
        manager.addWire(wire);
      }).toThrow('Invalid workflow: Missing Wires section');
    });
  });

  describe('removeWire()', () => {
    beforeEach(() => {
      // Add some wires to work with
      const wire1: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };

      const wire2: Wire = {
        from: { tool: 'process-tool', socket: 2 },
        to: { tool: 'output-tool', socket: 1 }
      };

      const wire3: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'output-tool', socket: 1 }
      };

      manager.addWire(wire1);
      manager.addWire(wire2);
      manager.addWire(wire3);
    });

    test('removes specific wire', () => {
      expect(manager.getWires()).toHaveLength(3);

      manager.removeWire(
        { tool: 'input-tool', socket: 1 },
        { tool: 'process-tool', socket: 1 }
      );

      const wires = manager.getWires();
      expect(wires).toHaveLength(2);
      expect(wires).not.toContainEqual({
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      });
      expect(wires).toContainEqual({
        from: { tool: 'process-tool', socket: 2 },
        to: { tool: 'output-tool', socket: 1 }
      });
      expect(wires).toContainEqual({
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'output-tool', socket: 1 }
      });
    });

    test('does nothing when removing non-existent wire', () => {
      expect(manager.getWires()).toHaveLength(3);

      manager.removeWire(
        { tool: 'non-existent', socket: 1 },
        { tool: 'also-non-existent', socket: 1 }
      );

      expect(manager.getWires()).toHaveLength(3);
    });

    test('removes all matching wires when duplicates exist', () => {
      // Add a duplicate wire
      const duplicateWire: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };
      manager.addWire(duplicateWire);

      expect(manager.getWires()).toHaveLength(4);

      manager.removeWire(
        { tool: 'input-tool', socket: 1 },
        { tool: 'process-tool', socket: 1 }
      );

      const wires = manager.getWires();
      expect(wires).toHaveLength(2); // Should remove both duplicates
      expect(wires).not.toContainEqual({
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      });
    });

    test('handles removing last wire', () => {
      // Remove all wires one by one
      manager.removeWire(
        { tool: 'input-tool', socket: 1 },
        { tool: 'process-tool', socket: 1 }
      );
      manager.removeWire(
        { tool: 'process-tool', socket: 2 },
        { tool: 'output-tool', socket: 1 }
      );
      manager.removeWire(
        { tool: 'input-tool', socket: 1 },
        { tool: 'output-tool', socket: 1 }
      );

      expect(manager.getWires()).toHaveLength(0);
    });

    test('removes wire from XML structure', () => {
      manager.removeWire(
        { tool: 'input-tool', socket: 1 },
        { tool: 'process-tool', socket: 1 }
      );

      const xml = manager.toXMLString();
      // Check that the specific wire connection is gone
      expect(xml).not.toContain('tool="input-tool" socket="1"/><To tool="process-tool" socket="1"');
      expect(xml).toContain('tool="process-tool" socket="2"'); // Other wires remain
    });

    test('exact match required for wire removal', () => {
      expect(manager.getWires()).toHaveLength(3);

      // Try removing with wrong socket number
      manager.removeWire(
        { tool: 'input-tool', socket: 2 }, // Wrong socket
        { tool: 'process-tool', socket: 1 }
      );

      expect(manager.getWires()).toHaveLength(3); // No change

      // Try removing with wrong tool name
      manager.removeWire(
        { tool: 'wrong-tool', socket: 1 },
        { tool: 'process-tool', socket: 1 }
      );

      expect(manager.getWires()).toHaveLength(3); // No change
    });
  });

  describe('removeWiresByTool() (via removeTool)', () => {
    beforeEach(() => {
      // Add some wires to work with
      const wire1: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };

      const wire2: Wire = {
        from: { tool: 'process-tool', socket: 2 },
        to: { tool: 'output-tool', socket: 1 }
      };

      const wire3: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'output-tool', socket: 1 }
      };

      manager.addWire(wire1);
      manager.addWire(wire2);
      manager.addWire(wire3);
    });

    test('removes all wires connected to tool when tool is removed', () => {
      expect(manager.getWires()).toHaveLength(3);
      expect(manager.getTools()).toHaveLength(3);

      // Remove the process-tool, which should remove wires connected to it
      manager.removeTool('process-tool');

      const wires = manager.getWires();
      expect(wires).toHaveLength(1); // Only wire3 should remain
      expect(wires[0]).toEqual({
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'output-tool', socket: 1 }
      });

      expect(manager.getTools()).toHaveLength(2); // Tool is also removed
    });

    test('removes wires where tool is source', () => {
      expect(manager.getWires()).toHaveLength(3);

      manager.removeTool('input-tool');

      const wires = manager.getWires();
      expect(wires).toHaveLength(1); // Only wire2 should remain
      expect(wires[0]).toEqual({
        from: { tool: 'process-tool', socket: 2 },
        to: { tool: 'output-tool', socket: 1 }
      });
    });

    test('removes wires where tool is target', () => {
      expect(manager.getWires()).toHaveLength(3);

      manager.removeTool('output-tool');

      const wires = manager.getWires();
      expect(wires).toHaveLength(1); // Only wire1 should remain
      expect(wires[0]).toEqual({
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      });
    });

    test('handles removing tool with no connected wires', () => {
      // Add a tool with no wires
      const isolatedTool: Tool = {
        id: 'isolated-tool',
        type: 'Transform',
        x: 700,
        y: 300,
        config: {},
        sockets: []
      };
      manager.addTool(isolatedTool);

      expect(manager.getWires()).toHaveLength(3);
      expect(manager.getTools()).toHaveLength(4);

      manager.removeTool('isolated-tool');

      expect(manager.getWires()).toHaveLength(3); // Wires unchanged
      expect(manager.getTools()).toHaveLength(3); // Tool removed
    });
  });

  describe('Wire management integration', () => {
    test('wire operations work together correctly', () => {
      // Start fresh
      const emptyManager = new XMLWorkflowManager();
      
      // Add tools
      const tool1: Tool = {
        id: 'integration-input',
        type: 'Input',
        x: 100,
        y: 100,
        config: {},
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };

      const tool2: Tool = {
        id: 'integration-output',
        type: 'Output',
        x: 300,
        y: 100,
        config: {},
        sockets: [{ id: 1, direction: 'input', multiple: false }]
      };

      emptyManager.addTool(tool1);
      emptyManager.addTool(tool2);

      // Add wire
      const wire: Wire = {
        from: { tool: 'integration-input', socket: 1 },
        to: { tool: 'integration-output', socket: 1 }
      };

      emptyManager.addWire(wire);
      expect(emptyManager.getWires()).toHaveLength(1);
      expect(emptyManager.getTools()).toHaveLength(2);

      // Remove wire
      emptyManager.removeWire(
        { tool: 'integration-input', socket: 1 },
        { tool: 'integration-output', socket: 1 }
      );
      expect(emptyManager.getWires()).toHaveLength(0);
      expect(emptyManager.getTools()).toHaveLength(2); // Tools remain

      // Add wire back and remove tool (should cascade remove wire)
      emptyManager.addWire(wire);
      expect(emptyManager.getWires()).toHaveLength(1);

      emptyManager.removeTool('integration-input');
      expect(emptyManager.getWires()).toHaveLength(0); // Wire auto-removed
      expect(emptyManager.getTools()).toHaveLength(1); // One tool remains
    });

    test('wire operations survive XML round-trip', () => {
      const wire1: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'process-tool', socket: 1 }
      };

      const wire2: Wire = {
        from: { tool: 'process-tool', socket: 2 },
        to: { tool: 'output-tool', socket: 1 }
      };

      manager.addWire(wire1);
      manager.addWire(wire2);

      const xml = manager.toXMLString();

      // Create new manager from XML
      const newManager = new XMLWorkflowManager(xml);
      const wires = newManager.getWires();

      expect(wires).toHaveLength(2);
      expect(wires).toContainEqual(wire1);
      expect(wires).toContainEqual(wire2);
    });

    test('clear() removes all wires and tools', () => {
      const wire: Wire = {
        from: { tool: 'input-tool', socket: 1 },
        to: { tool: 'output-tool', socket: 1 }
      };

      manager.addWire(wire);
      expect(manager.getWires()).toHaveLength(1);
      expect(manager.getTools()).toHaveLength(3);

      manager.clear();

      expect(manager.getWires()).toHaveLength(0);
      expect(manager.getTools()).toHaveLength(0);
    });

    test('complex workflow with multiple tools and wires', () => {
      // Create a more complex workflow
      const additionalTool: Tool = {
        id: 'filter-tool',
        type: 'Filter',
        x: 200,
        y: 300,
        config: { filterType: 'exclude' },
        sockets: [
          { id: 1, direction: 'input', multiple: false },
          { id: 2, direction: 'output', multiple: false }
        ]
      };

      manager.addTool(additionalTool);

      const wires: Wire[] = [
        { from: { tool: 'input-tool', socket: 1 }, to: { tool: 'process-tool', socket: 1 } },
        { from: { tool: 'input-tool', socket: 1 }, to: { tool: 'filter-tool', socket: 1 } },
        { from: { tool: 'process-tool', socket: 2 }, to: { tool: 'output-tool', socket: 1 } },
        { from: { tool: 'filter-tool', socket: 2 }, to: { tool: 'output-tool', socket: 1 } }
      ];

      wires.forEach(wire => manager.addWire(wire));

      expect(manager.getWires()).toHaveLength(4);
      expect(manager.getTools()).toHaveLength(4);

      // Remove filter tool - should remove 2 wires
      manager.removeTool('filter-tool');

      expect(manager.getWires()).toHaveLength(2);
      expect(manager.getTools()).toHaveLength(3);

      const remainingWires = manager.getWires();
      expect(remainingWires).toContainEqual({ from: { tool: 'input-tool', socket: 1 }, to: { tool: 'process-tool', socket: 1 } });
      expect(remainingWires).toContainEqual({ from: { tool: 'process-tool', socket: 2 }, to: { tool: 'output-tool', socket: 1 } });
    });
  });
});
