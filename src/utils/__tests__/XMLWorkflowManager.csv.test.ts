import { describe, test, expect } from 'vitest';
import { XMLWorkflowManager } from '../XMLWorkflowManager';
import { CSVConfig } from '../../domain/dataSources/csv';

describe('XMLWorkflowManager CSV Configuration', () => {
  test('should serialize CSV configuration with tiered structure', () => {
    const manager = new XMLWorkflowManager();
    
    const csvConfig: CSVConfig = {
      category: 'file',
      type: 'csv',
      filePath: '/path/to/data.csv',
      options: {
        sep: ';',
        encoding: 'latin1',
        header: 0,
        skiprows: 2,
        nrows: 1000,
        usecols: ['name', 'age', 'salary'],
        na_values: ['NULL', 'N/A']
      }
    };

    // Add a tool with CSV configuration
    manager.addTool({
      id: 'test-input',
      type: 'Input',
      x: 100,
      y: 200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: csvConfig as any,
      sockets: [{ id: 0, direction: 'output', multiple: false }]
    });

    // Get the XML
    const xml = manager.toXMLString();
    
    // Verify the structure
    expect(xml).toContain('<category>file</category>');
    expect(xml).toContain('<type>csv</type>');
    expect(xml).toContain('<filePath>/path/to/data.csv</filePath>');
    expect(xml).toContain('<options>');
    expect(xml).toContain('<sep>;</sep>');
    expect(xml).toContain('<encoding>latin1</encoding>');
    expect(xml).toContain('<header>0</header>');
    expect(xml).toContain('<skiprows>2</skiprows>');
    expect(xml).toContain('<nrows>1000</nrows>');
    expect(xml).toContain('<usecols>name,age,salary</usecols>');
    expect(xml).toContain('<na_values>NULL,N/A</na_values>');
    expect(xml).toContain('</options>');
  });

  test('should deserialize CSV configuration correctly', () => {
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow version="0.1.0" xmlns="https://docs.sigilweaver.com/schema/workflow">
  <Meta>
    <n>Test Workflow</n>
    <Description><![CDATA[Test]]></Description>
    <Author>Test</Author>
    <WorkflowId>test-id</WorkflowId>
    <Created>2025-09-06T00:00:00.000Z</Created>
  </Meta>
  <Layout>
    <Container id="root" name="Root Container" x="0" y="0" width="1200" height="800">
      <Tool id="test-input" type="Input" x="100" y="200">
        <Config>
          <category>file</category>
          <type>csv</type>
          <filePath>/path/to/data.csv</filePath>
          <options>
            <sep>;</sep>
            <encoding>latin1</encoding>
            <header>0</header>
            <skiprows>2</skiprows>
            <nrows>1000</nrows>
            <usecols>name,age,salary</usecols>
            <na_values>NULL,N/A</na_values>
          </options>
        </Config>
        <Sockets>
          <Socket id="0" direction="output"/>
        </Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires></Wires>
</Workflow>`;

    const manager = new XMLWorkflowManager(xmlString);
    const tools = manager.getTools();
    
    expect(tools).toHaveLength(1);
    
    const tool = tools[0]!;
    expect(tool.id).toBe('test-input');
    expect(tool.config.category).toBe('file');
    expect(tool.config.type).toBe('csv');
    expect(tool.config.filePath).toBe('/path/to/data.csv');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = tool.config.options as any;
    expect(options.sep).toBe(';');
    expect(options.encoding).toBe('latin1');
    expect(options.header).toBe(0);
    expect(options.skiprows).toBe(2);
    expect(options.nrows).toBe(1000);
    expect(options.usecols).toEqual(['name', 'age', 'salary']);
    expect(options.na_values).toEqual(['NULL', 'N/A']);
  });

  test('should only serialize non-default values', () => {
    const manager = new XMLWorkflowManager();
    
    const csvConfig = {
      category: 'file',
      type: 'csv',
      filePath: '/path/to/data.csv',
      options: {
        sep: ',' // This is default, should not appear
        // No encoding specified - auto-detect is default
      }
    };

    manager.addTool({
      id: 'test-input',
      type: 'Input',
      x: 100,
      y: 200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: csvConfig as any,
      sockets: [{ id: 0, direction: 'output', multiple: false }]
    });

    const xml = manager.toXMLString();
    
    // Should contain the structure but not the default values
    expect(xml).toContain('<category>file</category>');
    expect(xml).toContain('<type>csv</type>');
    expect(xml).toContain('<filePath>/path/to/data.csv</filePath>');
    // Options element should NOT be present since all values are defaults
    expect(xml).not.toContain('<options>');
    expect(xml).not.toContain('<options/>');
    
    // Default values should not appear
    expect(xml).not.toContain('<sep>,</sep>');
    // Auto-detect encoding should not appear either
    expect(xml).not.toContain('<encoding>');
  });
});
