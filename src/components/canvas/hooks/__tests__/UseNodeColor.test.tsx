import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Tool } from '@domain/workflow/entities/workflow';
import type { Node } from '@xyflow/react';

// IMPORTANT: mock must be declared BEFORE importing the hook under test
vi.mock('@contexts/ThemeContext', () => {
  type ShadeScale = { [k in 50|100|200|300|400|500|600|700|800|900]: string };
  const scale = (val: string): ShadeScale => ({50:'#',100:'#',200:'#',300:'#',400:'#',500:val,600:'#',700:'#',800:'#',900:'#'});
  const mockTheme = {
    colors: {
      canvas: { minimap: { viewport: '#VIEWPORT', background: '#000', border: '#111', mask: '#222' }, background: '#fff', grid: { primary: '#333', secondary: '#444' }, controls: { background: '#000', border: '#000', shadow: '#000', button: { default: { background: '', border: '', text: '' }, hover: { background: '', border: '', text: '' }, active: { background: '', border: '', text: '' }, disabled: { background: '', border: '', text: '' } } } },
      palette: {
        tools: {
          inout: scale('#INOUT'),
          preparation: scale('#PREP'),
          join: scale('#JOIN'),
          aggregate: scale('#AGG'),
          favorites: scale('#FAV')
        }
      }
    }
  } as const;
  return { useTheme: () => ({ currentTheme: mockTheme }) };
});

import { useNodeColor } from '../useNodeColor';

// Helper to build a Tool quickly
const makeTool = (id: string, type: string): Tool => ({
  id,
  type,
  x: 0,
  y: 0,
  config: {},
  sockets: []
});

describe('UseNodeColor', () => {
  it('returns in/out category color', () => {
    const tools = [makeTool('t1', 'Input')]; // Input -> category inout
    const { result } = renderHook(() => useNodeColor(tools));
  const color = result.current({ id: 't1' } as Partial<Node> as Node);
    expect(color).toBe('#INOUT');
  });

  it('returns preparation category color', () => {
    const tools = [makeTool('t2', 'Filter')]; // Filter -> preparation
    const { result } = renderHook(() => useNodeColor(tools));
  const color = result.current({ id: 't2' } as Partial<Node> as Node);
    expect(color).toBe('#PREP');
  });

  it('returns join category color', () => {
    const tools = [makeTool('t3', 'Join')];
    const { result } = renderHook(() => useNodeColor(tools));
  const color = result.current({ id: 't3' } as Partial<Node> as Node);
    expect(color).toBe('#JOIN');
  });

  it('returns aggregate category color', () => {
    const tools = [makeTool('t4', 'Summarize')];
    const { result } = renderHook(() => useNodeColor(tools));
  const color = result.current({ id: 't4' } as Partial<Node> as Node);
    expect(color).toBe('#AGG');
  });

  it('falls back when tool id not found', () => {
    const tools = [makeTool('t5', 'Input')];
    const { result } = renderHook(() => useNodeColor(tools));
  const color = result.current({ id: 'missing' } as Partial<Node> as Node);
    expect(color).toBe('#VIEWPORT');
  });

  it('falls back when tool definition missing', () => {
    const tools = [makeTool('t6', 'UnknownType')]; // Not in TOOL_DEFINITIONS
    const { result } = renderHook(() => useNodeColor(tools));
  const color = result.current({ id: 't6' } as Partial<Node> as Node);
    expect(color).toBe('#VIEWPORT');
  });
});
