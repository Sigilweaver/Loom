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

describe('XMLWorkflowManager - Metadata Operations', () => {
  let manager: XMLWorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new XMLWorkflowManager();
  });

  describe('getMetadata()', () => {
    test('returns default metadata for new workflow', () => {
      const metadata = manager.getMetadata();
      
      expect(metadata.name).toBe('New Workflow');
      expect(metadata.description).toContain('A new workflow');
      expect(metadata.author).toBe('Workflow Designer');
      expect(metadata.workflowId).toBe('test-uuid-123');
      expect(metadata.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('returns metadata from loaded XML', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Custom Workflow Name</n>
    <Description>
      <![CDATA[
      This is a custom workflow description
      with multiple lines and special characters!
      ]]>
    </Description>
    <Author>John Doe</Author>
    <WorkflowId>custom-workflow-123</WorkflowId>
    <Created>2024-12-25T10:30:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const metadata = manager.getMetadata();

      expect(metadata.name).toBe('Custom Workflow Name');
      expect(metadata.description).toContain('This is a custom workflow description');
      expect(metadata.description).toContain('with multiple lines');
      expect(metadata.author).toBe('John Doe');
      expect(metadata.workflowId).toBe('custom-workflow-123');
      expect(metadata.created).toBe('2024-12-25T10:30:00.000Z');
    });

    test('handles missing optional metadata fields gracefully', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Minimal Workflow</n>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const metadata = manager.getMetadata();

      expect(metadata.name).toBe('Minimal Workflow');
      expect(metadata.description).toBe('');
      expect(metadata.author).toBe('Unknown'); // Default value
      expect(metadata.workflowId).toBe('test-uuid-123'); // Generated UUID
      expect(metadata.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Generated timestamp
    });

    test('handles CDATA sections in description', () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>CDATA Test</n>
    <Description><![CDATA[<script>alert('xss')</script>]]></Description>
    <Author>Test Author</Author>
    <WorkflowId>cdata-test</WorkflowId>
    <Created>2025-01-01T00:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      const metadata = manager.getMetadata();

      expect(metadata.description).toBe("<script>alert('xss')</script>");
    });
  });

  describe('updateMetadata()', () => {
    test('updates workflow name', () => {
      manager.updateMetadata({ name: 'Updated Workflow Name' });
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('Updated Workflow Name');
      
      // Other fields should remain unchanged
      expect(metadata.author).toBe('Workflow Designer');
      expect(metadata.workflowId).toBe('test-uuid-123');
    });

    test('updates workflow description', () => {
      const newDescription = 'This is an updated description\nwith multiple lines\nand special characters: <>&"\'';
      
      manager.updateMetadata({ description: newDescription });
      
      const metadata = manager.getMetadata();
      expect(metadata.description).toBe(newDescription);
    });

    test('updates workflow author', () => {
      manager.updateMetadata({ author: 'Jane Smith' });
      
      const metadata = manager.getMetadata();
      expect(metadata.author).toBe('Jane Smith');
    });

    test('updates multiple fields at once', () => {
      const updates = {
        name: 'Multi-Update Test',
        description: 'Updated description',
        author: 'Multi Author'
      };
      
      manager.updateMetadata(updates);
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('Multi-Update Test');
      expect(metadata.description).toBe('Updated description');
      expect(metadata.author).toBe('Multi Author');
      
      // Fields not updated should remain unchanged
      expect(metadata.workflowId).toBe('test-uuid-123');
      expect(metadata.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('handles XML-unfriendly characters in metadata', () => {
      const problematicData = {
        name: 'Workflow & Data <Processing>',
        description: 'Contains "quotes" and \'apostrophes\' and <xml-tags> & entities',
        author: 'Author "with" \'quotes\' & <brackets>'
      };
      
      manager.updateMetadata(problematicData);
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe(problematicData.name);
      expect(metadata.description).toBe(problematicData.description);
      expect(metadata.author).toBe(problematicData.author);
      
      // Ensure XML is still valid and properly escaped
      const xml = manager.toXMLString();
      expect(() => {
        new DOMParser().parseFromString(xml, 'text/xml');
      }).not.toThrow();
      
      // Check that XML contains properly escaped content
      expect(xml).toContain('&lt;'); // < should be escaped
      expect(xml).toContain('&amp;'); // & should be escaped
    });

    test('handles empty string updates', () => {
      manager.updateMetadata({ 
        name: '',
        description: '',
        author: ''
      });
      
      const metadata = manager.getMetadata();
      // Empty strings fall back to defaults due to || operator in getMetadata
      expect(metadata.name).toBe('Untitled Workflow'); // Falls back to default
      expect(metadata.description).toBe(''); // Description has no default fallback
      expect(metadata.author).toBe('Unknown'); // Falls back to default
    });

    test('preserves existing metadata when updating subset', () => {
      // Start with a workflow that has existing metadata
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Original Name</n>
    <Description>Original description</Description>
    <Author>Original Author</Author>
    <WorkflowId>original-id</WorkflowId>
    <Created>2024-01-01T00:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root"></Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

      manager = new XMLWorkflowManager(xmlString);
      
      // Update only the name
      manager.updateMetadata({ name: 'New Name Only' });
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('New Name Only');
      expect(metadata.description).toBe('Original description');
      expect(metadata.author).toBe('Original Author');
      expect(metadata.workflowId).toBe('original-id');
      expect(metadata.created).toBe('2024-01-01T00:00:00.000Z');
    });

    test('preserves XML structure after metadata updates', () => {
      manager.updateMetadata({ 
        name: 'Structure Test',
        description: 'Testing XML structure preservation',
        author: 'Structure Tester'
      });
      
      const xml = manager.toXMLString();
      
      // Should maintain proper XML structure
      expect(xml).toContain('<Workflow version="1.0.0"');
      expect(xml).toContain('<Meta>');
      expect(xml).toContain('<n>Structure Test</n>');
      expect(xml).toContain('<Author>Structure Tester</Author>');
      expect(xml).toContain('</Meta>');
      expect(xml).toContain('<Layout>');
      expect(xml).toContain('<Wires>');
      expect(xml).toContain('</Workflow>');
    });
  });

  describe('Metadata persistence', () => {
    test('metadata survives XML round-trip', () => {
      const originalUpdates = {
        name: 'Round Trip Test',
        description: 'Testing metadata persistence through XML serialization',
        author: 'Persistence Tester'
      };
      
      manager.updateMetadata(originalUpdates);
      const xml = manager.toXMLString();
      
      // Create new manager from the XML
      const newManager = new XMLWorkflowManager(xml);
      const metadata = newManager.getMetadata();
      
      expect(metadata.name).toBe('Round Trip Test');
      expect(metadata.description).toBe('Testing metadata persistence through XML serialization');
      expect(metadata.author).toBe('Persistence Tester');
    });

    test('metadata persists after other operations', () => {
      manager.updateMetadata({ 
        name: 'Persistence Test',
        author: 'Test Author'
      });
      
      // Perform other operations
      manager.clear();
      manager.newWorkflow();
      
      // After newWorkflow(), metadata should be reset to defaults
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe('New Workflow');
      expect(metadata.author).toBe('Workflow Designer');
    });

    test('metadata update affects toXMLString output immediately', () => {
      manager.updateMetadata({ name: 'Immediate Test' });
      
      const xml = manager.toXMLString();
      expect(xml).toContain('<n>Immediate Test</n>');
      expect(xml).not.toContain('<n>New Workflow</n>');
    });
  });

  describe('Edge cases and validation', () => {
    test('handles extremely long metadata values', () => {
      const longName = 'A'.repeat(1000);
      const longDescription = 'B'.repeat(5000);
      const longAuthor = 'C'.repeat(500);
      
      manager.updateMetadata({
        name: longName,
        description: longDescription,
        author: longAuthor
      });
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe(longName);
      expect(metadata.description).toBe(longDescription);
      expect(metadata.author).toBe(longAuthor);
    });

    test('handles Unicode characters in metadata', () => {
      const unicodeName = '工作流程 🔧 Workflow';
      const unicodeDescription = 'Descrição com acentos: çãéíóú 中文描述 🚀';
      const unicodeAuthor = 'Üser Nâme 测试';
      
      manager.updateMetadata({
        name: unicodeName,
        description: unicodeDescription,
        author: unicodeAuthor
      });
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe(unicodeName);
      expect(metadata.description).toBe(unicodeDescription);
      expect(metadata.author).toBe(unicodeAuthor);
      
      // Ensure round-trip preservation
      const xml = manager.toXMLString();
      const newManager = new XMLWorkflowManager(xml);
      const roundTripMetadata = newManager.getMetadata();
      
      expect(roundTripMetadata.name).toBe(unicodeName);
      expect(roundTripMetadata.description).toBe(unicodeDescription);
      expect(roundTripMetadata.author).toBe(unicodeAuthor);
    });

    test('handles null and undefined values gracefully', () => {
      // TypeScript should prevent this, but test runtime behavior
      manager.updateMetadata({ 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: null as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: undefined as any,
        author: 'Valid Author'
      });
      
      const metadata = manager.getMetadata();
      expect(metadata.author).toBe('Valid Author');
      // null/undefined should be handled gracefully (empty string or original value)
    });

    test('handles XML-unfriendly characters in metadata', () => {
      const problematicData = {
        name: 'Workflow & Data <Processing>',
        description: 'Contains "quotes" and \'apostrophes\' and <xml-tags> & entities',
        author: 'Author "with" \'quotes\' & <brackets>'
      };
      
      manager.updateMetadata(problematicData);
      
      const metadata = manager.getMetadata();
      expect(metadata.name).toBe(problematicData.name);
      expect(metadata.description).toBe(problematicData.description);
      expect(metadata.author).toBe(problematicData.author);
      
      // Ensure XML is still valid
      const xml = manager.toXMLString();
      expect(() => {
        new DOMParser().parseFromString(xml, 'text/xml');
      }).not.toThrow();
    });
  });
});
