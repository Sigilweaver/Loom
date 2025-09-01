import { describe, test, expect } from 'vitest';
import { XMLWorkflowManager } from '../XMLWorkflowManager';

describe('XMLWorkflowManager Security', () => {
  test('prevents XXE attacks by removing DOCTYPE declarations', () => {
    const maliciousXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE workflow [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Workflow version="1.0.0">
  <Meta>
    <n>&xxe;</n>
  </Meta>
  <Layout><Container id="root"></Container></Layout>
  <Wires></Wires>
</Workflow>`;

    // Should reject the XML due to undefined entity reference after DOCTYPE removal
    expect(() => {
      new XMLWorkflowManager(maliciousXml);
    }).toThrow('Invalid XML format');
  });

  test('allows clean XML without entity references', () => {
    const cleanXml = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Clean workflow name</n>
  </Meta>
  <Layout><Container id="root"></Container></Layout>
  <Wires></Wires>
</Workflow>`;

    // Should work fine with clean XML
    const manager = new XMLWorkflowManager(cleanXml);
    const metadata = manager.getMetadata();
    expect(metadata.name).toBe('Clean workflow name');
  });

  test('removes custom entity references while preserving safe ones', () => {
    const xmlWithEntities = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <n>Test &amp; &lt;safe&gt; &customEntity;</n>
  </Meta>
  <Layout><Container id="root"></Container></Layout>
  <Wires></Wires>
</Workflow>`;

    const manager = new XMLWorkflowManager(xmlWithEntities);
    const metadata = manager.getMetadata();
    // Check that our sanitization worked correctly
    // (Note: Browser XML parser automatically decodes safe entities)
    expect(metadata.name).toContain('Test & <safe>'); // Entities get decoded by browser
    expect(metadata.name).not.toContain('&customEntity;'); // Custom entity should be removed
  });

  test('preserves CDATA sections for legitimate workflow descriptions', () => {
    const xmlWithCDATA = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="1.0.0">
  <Meta>
    <Description><![CDATA[
      This is a workflow description with <special> characters & symbols.
    ]]></Description>
  </Meta>
  <Layout><Container id="root"></Container></Layout>
  <Wires></Wires>
</Workflow>`;

    expect(() => {
      const manager = new XMLWorkflowManager(xmlWithCDATA);
      const metadata = manager.getMetadata();
      // CDATA content should be preserved for descriptions
      expect(metadata.description).toContain('<special>');
      expect(metadata.description).toContain('& symbols');
    }).not.toThrow();
  });

  test('rejects malformed XML', () => {
    const malformedXml = '<Workflow><unclosed>';

    expect(() => {
      new XMLWorkflowManager(malformedXml);
    }).toThrow('Invalid XML format');
  });

  test('rejects XML without Workflow root element', () => {
    const wrongRootXml = '<?xml version="1.0"?><SomeOtherRoot></SomeOtherRoot>';

    expect(() => {
      const manager = new XMLWorkflowManager();
      manager.loadFromXML(wrongRootXml);
    }).toThrow('Invalid workflow format: Missing Workflow root element');
  });
});
