import { describe, test, expect, vi, beforeEach } from 'vitest';
import { XMLWorkflowManager } from '../XMLWorkflowManager';

// Mock uuid to get predictable IDs in tests
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

// Mock package.json version
vi.mock('../../../package.json', () => ({
  default: { version: '1.0.0' }
}));

describe('XMLWorkflowManager - Basic Lifecycle', () => {
  let manager: XMLWorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    test('creates new workflow when no XML provided', () => {
      manager = new XMLWorkflowManager();
      
      const xml = manager.toXMLString();
      expect(xml).toContain('<Workflow version="1.0.0"');
      expect(xml).toContain('<Meta>');
      expect(xml).toContain('<Container');
      expect(xml).toContain('<Wires>');
    });

    test('creates new workflow with default metadata', () => {
      manager = new XMLWorkflowManager();
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('New Workflow');
      expect(metadata.description).toContain('A new workflow');
      expect(metadata.author).toBe('Workflow Designer');
      expect(metadata.workflowId).toBe('test-uuid-123');
      expect(metadata.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
    });

    test('loads from valid XML string', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test Workflow</n>
    <Description>Test description</Description>
    <Author>Test Author</Author>
    <WorkflowId>test-id-456</WorkflowId>
    <Created>2025-01-01T00:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('Test Workflow');
      expect(metadata.description).toContain('Test description');
      expect(metadata.author).toBe('Test Author');
      expect(metadata.workflowId).toBe('test-id-456');
      expect(metadata.created).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('newWorkflow()', () => {
    test('resets to fresh workflow', () => {
      // Start with custom XML
      const customXml = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Custom Workflow</n>
    <Description>Custom description</Description>
    <Author>Custom Author</Author>
    <WorkflowId>custom-id</WorkflowId>
    <Created>2025-01-01T00:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(customXml);
      expect(manager.getMetadata().name).toBe('Custom Workflow');

      // Reset to new workflow
      manager.newWorkflow();
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('New Workflow');
      expect(metadata.author).toBe('Workflow Designer');
      expect(metadata.workflowId).toBe('test-uuid-123');
    });

    test('clears all tools and wires', () => {
      manager = new XMLWorkflowManager();
      
      // Initially should be empty
      expect(manager.getTools()).toHaveLength(0);
      expect(manager.getWires()).toHaveLength(0);
      
      // Reset should still be empty (testing that reset works)
      manager.newWorkflow();
      expect(manager.getTools()).toHaveLength(0);
      expect(manager.getWires()).toHaveLength(0);
    });
  });

  describe('toXMLString()', () => {
    test('produces valid XML structure', () => {
      manager = new XMLWorkflowManager();
      const xml = manager.toXMLString();
      
      // Should be valid XML (even without declaration)
      expect(() => {
        new DOMParser().parseFromString(xml, 'text/xml');
      }).not.toThrow();
      
      // Should have required elements  
      expect(xml).toContain('<Workflow version="1.0.0"');
      expect(xml).toContain('<Meta>');
      expect(xml).toContain('<n>New Workflow</n>');
      expect(xml).toContain('<Layout>');
      expect(xml).toContain('<Wires>');
      expect(xml).toContain('</Workflow>');
    });

    test('updates version attribute to current package version', () => {
      manager = new XMLWorkflowManager();
      const xml = manager.toXMLString();
      
      expect(xml).toContain('version="1.0.0"');
    });

    test('preserves namespace declaration', () => {
      manager = new XMLWorkflowManager();
      const xml = manager.toXMLString();
      
      expect(xml).toContain('xmlns="https://docs.sigilweaver.com/schema/workflow"');
    });
  });

  describe('loadFromXML()', () => {
    beforeEach(() => {
      manager = new XMLWorkflowManager();
    });

    test('replaces current workflow with loaded XML', () => {
      // Verify initial state
      expect(manager.getMetadata().name).toBe('New Workflow');
      
      const newXml = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Loaded Workflow</n>
    <Description>Loaded from XML</Description>
    <Author>XML Author</Author>
    <WorkflowId>loaded-id</WorkflowId>
    <Created>2025-01-01T12:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager.loadFromXML(newXml);
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('Loaded Workflow');
      expect(metadata.description).toContain('Loaded from XML');
      expect(metadata.author).toBe('XML Author');
      expect(metadata.workflowId).toBe('loaded-id');
      expect(metadata.created).toBe('2025-01-01T12:00:00.000Z');
    });

    test('validates XML structure before loading', () => {
      expect(() => {
        manager.loadFromXML('<?xml version="1.0"?><NotWorkflow></NotWorkflow>');
      }).toThrow('Invalid workflow format: Missing Workflow root element');
    });

    test('handles minimal valid workflow XML', () => {
      const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Minimal</n>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      expect(() => {
        manager.loadFromXML(minimalXml);
      }).not.toThrow();
      
      expect(manager.getMetadata().name).toBe('Minimal');
    });
  });

  describe('clear()', () => {
    test('removes all tools and wires but preserves metadata', () => {
      manager = new XMLWorkflowManager();
      
      // Set custom metadata first
      manager.updateMetadata({
        name: 'Test Workflow',
        description: 'Test description',
        author: 'Test Author'
      });
      
      // Clear should preserve metadata
      manager.clear();
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('Test Workflow');
      expect(metadata.description).toContain('Test description');
      expect(metadata.author).toBe('Test Author');
      
      // But should clear tools and wires
      expect(manager.getTools()).toHaveLength(0);
      expect(manager.getWires()).toHaveLength(0);
    });
  });

  describe('Round-trip consistency', () => {
    test('XML → Manager → XML produces equivalent result', () => {
      const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0" xmlns="https://docs.sigilweaver.com/schema/workflow">
  <Meta>
    <n>Round Trip Test</n>
    <Description>
      <![CDATA[
      Test workflow for round-trip consistency
      ]]>
    </Description>
    <Author>Test Author</Author>
    <WorkflowId>round-trip-id</WorkflowId>
    <Created>2025-01-01T12:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root" name="Root Container" x="0" y="0" width="1200" height="800">
    </Container>
  </Layout>
  <Wires>
  </Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(originalXml);
      const roundTripXml = manager.toXMLString();
      
      // Parse and verify round-trip consistency
      const roundTripDoc = new DOMParser().parseFromString(roundTripXml, 'text/xml');
      
      // Check metadata preservation
      expect(roundTripDoc.querySelector('n')?.textContent).toBe('Round Trip Test');
      expect(roundTripDoc.querySelector('Author')?.textContent).toBe('Test Author');
      expect(roundTripDoc.querySelector('WorkflowId')?.textContent).toBe('round-trip-id');
      expect(roundTripDoc.querySelector('Created')?.textContent).toBe('2025-01-01T12:00:00.000Z');
      
      // Check structure preservation
      expect(roundTripDoc.querySelector('Workflow')).toBeTruthy();
      expect(roundTripDoc.querySelector('Meta')).toBeTruthy();
      expect(roundTripDoc.querySelector('Layout')).toBeTruthy();
      expect(roundTripDoc.querySelector('Wires')).toBeTruthy();
    });
  });
});
