import { XMLWorkflowManager } from './XMLWorkflowManager';
import pkg from '../../package.json';
import { generateUniqueId } from './id';
import type { Tool, ToolConfig } from '../domain/workflow/entities/workflow';

// Build an XML clipboard fragment from a full workflow XML string and a set of selected tool IDs
export function buildClipboardFragment(workflowXml: string, selectedToolIds: string[]): string {
  const sel = new Set(selectedToolIds);
  if (sel.size === 0) return '';

  const doc = new DOMParser().parseFromString(workflowXml, 'text/xml');
  const err = doc.querySelector('parsererror');
  if (err) return '';

  // Collect tool elements and compute bounds
  const tools: Element[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  selectedToolIds.forEach(id => {
    const el = doc.querySelector(`Tool[id="${id}"]`);
    if (el) {
      tools.push(el);
      const x = parseFloat(el.getAttribute('x') || '0');
      const y = parseFloat(el.getAttribute('y') || '0');
      if (!Number.isNaN(x)) minX = Math.min(minX, x);
      if (!Number.isNaN(y)) minY = Math.min(minY, y);
    }
  });
  if (tools.length === 0) return '';
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;

  // Collect internal wires (both endpoints inside selection)
  const wires: Element[] = [];
  const wireElements = doc.querySelectorAll('Wires Wire');
  wireElements.forEach(wireEl => {
    const fromEl = wireEl.querySelector('From');
    const toEl = wireEl.querySelector('To');
    const fromTool = fromEl?.getAttribute('tool') || '';
    const toTool = toEl?.getAttribute('tool') || '';
    if (sel.has(fromTool) && sel.has(toTool)) {
      wires.push(wireEl);
    }
  });

  const serializer = new XMLSerializer();
  const toolsXml = tools.map(t => serializer.serializeToString(t)).join('');
  const wiresXml = wires.map(w => serializer.serializeToString(w)).join('');
  const now = new Date().toISOString();
  // Comment at the very top; omit XML declaration
  const fragment = `<!-- Sigilweaver Clipboard Fragment: copy of selected tools and internal wires. Version=${pkg.version} Created=${now} -->\n` +
    `<WorkflowFragment version="${pkg.version}" xmlns="https://docs.sigilweaver.com/schema/workflow">\n` +
    `  <Bounds minX="${minX}" minY="${minY}"/>\n` +
    `  <Tools>\n${toolsXml}\n  </Tools>\n` +
    `  <Wires>\n${wiresXml}\n  </Wires>\n` +
    `</WorkflowFragment>`;
  return fragment;
}

// Apply an XML clipboard fragment into the manager's document at the given anchor; returns new tool IDs
export function applyClipboardFragment(xmlManager: XMLWorkflowManager, fragmentXml: string, anchor: { x: number; y: number }): string[] {
  if (!fragmentXml || !fragmentXml.includes('<WorkflowFragment')) return [];
  const fragDoc = new DOMParser().parseFromString(fragmentXml, 'text/xml');
  const err = fragDoc.querySelector('parsererror');
  if (err) return [];

  const boundsEl = fragDoc.querySelector('Bounds');
  let minX = parseFloat(boundsEl?.getAttribute('minX') || '0');
  let minY = parseFloat(boundsEl?.getAttribute('minY') || '0');

  const toolEls = Array.from(fragDoc.querySelectorAll('Tools > Tool')) as Element[];
  if (toolEls.length === 0) return [];
  if (Number.isNaN(minX) || Number.isNaN(minY)) {
    // Fallback: compute from tools
    minX = Math.min(...toolEls.map(t => parseFloat(t.getAttribute('x') || '0')));
    minY = Math.min(...toolEls.map(t => parseFloat(t.getAttribute('y') || '0')));
    if (!Number.isFinite(minX)) minX = 0; if (!Number.isFinite(minY)) minY = 0;
  }

  const existingIds = new Set(xmlManager.getTools().map(t => t.id));
  const idMap = new Map<string, string>();
  const addedIds: string[] = [];

  // Add tools with new IDs and adjusted positions
  toolEls.forEach(tEl => {
    const oldId = tEl.getAttribute('id') || '';
    const type = tEl.getAttribute('type') || '';
    const x = parseFloat(tEl.getAttribute('x') || '0');
    const y = parseFloat(tEl.getAttribute('y') || '0');
    const newId = generateUniqueId(existingIds, 8);
    existingIds.add(newId);
    idMap.set(oldId, newId);
    addedIds.push(newId);

    // Parse config
    const config: ToolConfig = {};
    const configEl = tEl.querySelector('Config');
    if (configEl) {
      Array.from(configEl.children).forEach(child => {
        config[child.tagName] = child.textContent;
      });
    }
    // Parse sockets
    const sockets = Array.from(tEl.querySelectorAll('Sockets Socket')).map(socketEl => {
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

    const nx = (Number.isFinite(x) ? x : 0) - minX + anchor.x;
    const ny = (Number.isFinite(y) ? y : 0) - minY + anchor.y;
    const tool: Tool = { id: newId, type, x: nx, y: ny, config, sockets };
    xmlManager.addTool(tool);
  });

  // Add wires remapped to new tool IDs
  const wireEls = Array.from(fragDoc.querySelectorAll('Wires > Wire')) as Element[];
  wireEls.forEach(wEl => {
    const fromEl = wEl.querySelector('From');
    const toEl = wEl.querySelector('To');
    const of = fromEl?.getAttribute('tool') || '';
    const ot = toEl?.getAttribute('tool') || '';
    const nf = idMap.get(of);
    const nt = idMap.get(ot);
    if (!nf || !nt) return; // only internal wires
    const fromSocket = parseInt(fromEl?.getAttribute('socket') || '0');
    const toSocket = parseInt(toEl?.getAttribute('socket') || '0');
    if (Number.isNaN(fromSocket) || Number.isNaN(toSocket)) return;
    xmlManager.addWire({ from: { tool: nf, socket: fromSocket }, to: { tool: nt, socket: toSocket } });
  });

  return addedIds;
}
