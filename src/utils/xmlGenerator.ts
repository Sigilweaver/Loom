import { Workflow, Tool, Edge, Group } from '../types/workflow';

export function generateWorkflowXML(workflow: Workflow): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  
  const workflowElement = `<Workflow version="${workflow.version}" xmlns="${workflow.xmlns}">`;
  
  const metaSection = generateMetaSection(workflow.meta);
  const hierarchySection = generateHierarchySection(workflow.hierarchy);
  const edgesSection = generateEdgesSection(workflow.edges);
  
  return [
    xmlHeader,
    workflowElement,
    '',
    metaSection,
    '',
    hierarchySection,
    '',
    edgesSection,
    '</Workflow>'
  ].join('\n');
}

function generateMetaSection(meta: any): string {
  return [
    '  <Meta>',
    `    <Name>${meta.name}</Name>`,
    '    <Description>',
    '      <![CDATA[',
    `      ${meta.description}`,
    '      ]]>',
    '    </Description>',
    `    <Author>${meta.author}</Author>`,
    `    <WorkflowId>${meta.workflowId}</WorkflowId>`,
    `    <Created>${meta.created}</Created>`,
    '  </Meta>'
  ].join('\n');
}

function generateHierarchySection(hierarchy: Group): string {
  return [
    '  <Hierarchy>',
    generateGroupXML(hierarchy, '    '),
    '  </Hierarchy>'
  ].join('\n');
}

function generateGroupXML(group: Group, indent: string): string {
  const lines = [
    `${indent}<Group id="${group.id}" name="${group.name}" x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}">`
  ];
  
  if (group.groups && group.groups.length > 0) {
    group.groups.forEach(subGroup => {
      lines.push(generateGroupXML(subGroup, indent + '  '));
    });
  }
  
  if (group.tools.length > 0) {
    lines.push(`${indent}  <Tools>`);
    group.tools.forEach(tool => {
      lines.push(generateToolXML(tool, indent + '    '));
    });
    lines.push(`${indent}  </Tools>`);
  }
  
  lines.push(`${indent}</Group>`);
  
  return lines.join('\n');
}

function generateToolXML(tool: Tool, indent: string): string {
  const lines = [
    `${indent}<Tool id="${tool.id}" type="${tool.type}" x="${tool.x}" y="${tool.y}">`
  ];
  
  // Config section
  if (Object.keys(tool.config).length > 0) {
    lines.push(`${indent}  <Config>`);
    Object.entries(tool.config).forEach(([key, value]) => {
      lines.push(`${indent}    <${key}>${value}</${key}>`);
    });
    lines.push(`${indent}  </Config>`);
  }
  
  // Inlets section
  lines.push(`${indent}  <Inlets>`);
  tool.inlets.forEach(inlet => {
    lines.push(`${indent}    <Inlet id="${inlet.id}" />`);
  });
  lines.push(`${indent}  </Inlets>`);
  
  // Outlets section
  lines.push(`${indent}  <Outlets>`);
  tool.outlets.forEach(outlet => {
    lines.push(`${indent}    <Outlet id="${outlet.id}" />`);
  });
  lines.push(`${indent}  </Outlets>`);
  
  lines.push(`${indent}</Tool>`);
  
  return lines.join('\n');
}

function generateEdgesSection(edges: Edge[]): string {
  const lines = ['  <Edges>'];
  
  edges.forEach(edge => {
    lines.push('    <Edge>');
    lines.push(`      <From tool="${edge.from.tool}" port="${edge.from.port}" />`);
    lines.push(`      <To tool="${edge.to.tool}" port="${edge.to.port}" />`);
    lines.push('    </Edge>');
  });
  
  lines.push('  </Edges>');
  
  return lines.join('\n');
}
