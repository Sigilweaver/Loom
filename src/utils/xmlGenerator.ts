import { Workflow, Tool, Wire, Container } from '../types/workflow';

export function generateWorkflowXML(workflow: Workflow): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  
  const workflowElement = `<Workflow version="${workflow.version}" xmlns="${workflow.xmlns}">`;
  
  const metaSection = generateMetaSection(workflow.meta);
  const layoutSection = generateLayoutSection(workflow.layout);
  const wiresSection = generateWiresSection(workflow.wires);
  
  return [
    xmlHeader,
    workflowElement,
    '',
    metaSection,
    '',
    layoutSection,
    '',
    wiresSection,
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

function generateLayoutSection(layout: Container): string {
  return [
    '  <Layout>',
    generateContainerXML(layout, '    '),
    '  </Layout>'
  ].join('\n');
}

function generateContainerXML(container: Container, indent: string): string {
  const lines = [
    `${indent}<Container id="${container.id}" name="${container.name}" x="${container.x}" y="${container.y}" width="${container.width}" height="${container.height}">`
  ];
  
  if (container.containers && container.containers.length > 0) {
    container.containers.forEach(subContainer => {
      lines.push(generateContainerXML(subContainer, indent + '  '));
    });
  }
  
  if (container.tools.length > 0) {
    lines.push(`${indent}  <Tools>`);
    container.tools.forEach(tool => {
      lines.push(generateToolXML(tool, indent + '    '));
    });
    lines.push(`${indent}  </Tools>`);
  }
  
  lines.push(`${indent}</Container>`);
  
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
  
  // Sockets section
  lines.push(`${indent}  <Sockets>`);
  tool.sockets.forEach(socket => {
    const attributes = [`id="${socket.id}"`, `direction="${socket.direction}"`];
    if (socket.type) attributes.push(`type="${socket.type}"`);
    if (socket.multiple) attributes.push(`multiple="${socket.multiple}"`);
    lines.push(`${indent}    <Socket ${attributes.join(' ')} />`);
  });
  lines.push(`${indent}  </Sockets>`);
  
  lines.push(`${indent}</Tool>`);
  
  return lines.join('\n');
}

function generateWiresSection(wires: Wire[]): string {
  const lines = ['  <Wires>'];
  
  wires.forEach(wire => {
    lines.push('    <Wire>');
    lines.push(`      <From tool="${wire.from.tool}" socket="${wire.from.socket}" />`);
    lines.push(`      <To tool="${wire.to.tool}" socket="${wire.to.socket}" />`);
    lines.push('    </Wire>');
  });
  
  lines.push('  </Wires>');
  
  return lines.join('\n');
}
