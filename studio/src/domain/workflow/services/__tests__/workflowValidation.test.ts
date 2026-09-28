import { describe, it, expect } from 'vitest';
import type { Socket, Tool, ToolConfig, Wire } from '@domain/workflow/entities/workflow';
import {
  describeSummary,
  summarizeIssues,
  validateWorkflow,
  type ValidationIssue,
} from '../workflowValidation';

const input: Socket = { id: 'input', direction: 'input' };
const output: Socket = { id: 'output', direction: 'output' };

const makeTool = (
  id: string,
  type: string,
  config: ToolConfig = {},
  sockets: Socket[] = [input, output]
): Tool => ({ id, type, x: 0, y: 0, config, sockets });

const reader = (id = 'in', config: ToolConfig = { category: 'file', source: '/data/a.csv' }) =>
  makeTool(id, 'Input', config, [output]);
const writer = (id = 'out', config: ToolConfig = { destination: '/data/out.csv' }) =>
  makeTool(id, 'Output', config, [input]);

const wire = (from: string, to: string, fromSocket = 'output', toSocket = 'input'): Wire => ({
  from: { tool: from, socket: fromSocket },
  to: { tool: to, socket: toSocket },
});

const messages = (issues: ValidationIssue[]) => issues.map((i) => i.message);
const forTool = (issues: ValidationIssue[], toolId: string) =>
  issues.filter((i) => i.toolId === toolId);

describe('validateWorkflow', () => {
  it('reports an empty workflow as a warning', () => {
    const issues = validateWorkflow([], []);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.toolId).toBeUndefined();
  });

  it('accepts a complete read to write pipeline', () => {
    const tools = [reader(), writer()];
    expect(validateWorkflow(tools, [wire('in', 'out')])).toEqual([]);
  });

  it('flags a missing Write tool as an error and a missing Read tool as a warning', () => {
    const noWriter = validateWorkflow([reader()], []);
    expect(noWriter.some((i) => i.severity === 'error' && /Write tool/.test(i.message))).toBe(true);

    const noReader = validateWorkflow([makeTool('f', 'Filter'), writer()], [wire('f', 'out')]);
    expect(noReader.some((i) => i.severity === 'warning' && /Read tool/.test(i.message))).toBe(true);
  });

  it('flags unconnected required inputs', () => {
    const tools = [reader(), makeTool('sort', 'Sort', { sortColumns: [{ column: 'a' }] }), writer()];
    const issues = validateWorkflow(tools, [wire('sort', 'out')]);
    const sortIssues = forTool(issues, 'sort');
    expect(messages(sortIssues)).toEqual(['The input is not connected.']);
    // Its own output is used, and the reader is the unused one
    expect(forTool(issues, 'in').map((i) => i.message)).toEqual([
      expect.stringContaining('Nothing uses'),
    ]);
  });

  it('names left and right inputs on a join', () => {
    const join = makeTool('join', 'Join', { joinType: 'inner', leftKeys: ['a'], rightKeys: ['a'] }, [
      { id: 'input-left', direction: 'input', type: 'L' },
      { id: 'input-right', direction: 'input', type: 'R' },
      { id: 'output-match', direction: 'output', type: 'J' },
    ]);
    const issues = validateWorkflow(
      [reader(), join, writer()],
      [wire('in', 'join', 'output', 'input-left'), wire('join', 'out', 'output-match')]
    );
    expect(messages(forTool(issues, 'join'))).toEqual(['The right input is not connected.']);
  });

  it('flags a loop on every tool taking part in it', () => {
    const tools = [reader(), makeTool('a', 'Filter'), makeTool('b', 'Filter'), writer()];
    const wires = [wire('in', 'a'), wire('a', 'b'), wire('b', 'a'), wire('b', 'out')];
    const issues = validateWorkflow(tools, wires);
    expect(forTool(issues, 'a').some((i) => /loop/.test(i.message))).toBe(true);
    expect(forTool(issues, 'b').some((i) => /loop/.test(i.message))).toBe(true);
    expect(forTool(issues, 'in').some((i) => /loop/.test(i.message))).toBe(false);
    expect(forTool(issues, 'out').some((i) => /loop/.test(i.message))).toBe(false);
  });

  it('flags connections to tools that no longer exist', () => {
    const issues = validateWorkflow([reader(), writer()], [wire('in', 'out'), wire('in', 'ghost')]);
    expect(issues.some((i) => i.severity === 'error' && /does not exist/.test(i.message))).toBe(true);
  });

  describe('required settings', () => {
    const run = (tool: Tool) => {
      const upstream = reader();
      const sink = writer();
      const usable = tool.type === 'Input' || tool.type === 'Output';
      if (usable) return forTool(validateWorkflow([tool], []), tool.id);
      const wires = [wire('in', tool.id), wire(tool.id, 'out')];
      return forTool(validateWorkflow([upstream, tool, sink], wires), tool.id);
    };

    it('requires a file for Read and a destination for Write', () => {
      expect(messages(run(reader('r', { category: 'file', source: '' })))).toContain('Choose a file to read.');
      expect(messages(run(writer('w', { destination: '  ' })))).toContain(
        'Choose where to write the output.'
      );
    });

    it('requires a connection and query for database reads', () => {
      const found = messages(run(reader('db', { category: 'database' })));
      expect(found).toContain('Choose a database connection.');
      expect(found).toContain('Enter the SQL query to read.');
    });

    it('requires sort columns', () => {
      expect(messages(run(makeTool('s', 'Sort', { sortColumns: [] })))).toContain(
        'Choose at least one column to sort by.'
      );
      expect(run(makeTool('s', 'Sort', { sortColumns: [{ column: 'a' }] }))).toEqual([]);
    });

    it('warns (does not error) for an empty filter', () => {
      const issues = run(makeTool('f', 'Filter', { expression: '', conditions: [] }));
      expect(issues).toHaveLength(1);
      expect(issues[0]!.severity).toBe('warning');
      expect(run(makeTool('f', 'Filter', { expression: 'pl.col("a") > 1' }))).toEqual([]);
      expect(
        run(
          makeTool('f', 'Filter', {
            conditionGroup: { type: 'group', children: [{ column: 'a' }] } as unknown as ToolConfig['x'],
          })
        )
      ).toEqual([]);
    });

    it('requires complete formula operations', () => {
      expect(messages(run(makeTool('c', 'Formula', { operations: [] })))).toContain(
        'Add at least one calculation.'
      );
      expect(
        messages(run(makeTool('c', 'Formula', { operations: [{ columnName: 'x', expression: '' }] })))
      ).toContain('Every calculation needs an output column name and an expression.');
      expect(
        run(makeTool('c', 'Formula', { operations: [{ columnName: 'x', expression: 'pl.col("a")' }] }))
      ).toEqual([]);
    });

    it('requires matching join keys unless it is a cross join', () => {
      const sockets: Socket[] = [
        { id: 'input-left', direction: 'input', type: 'L' },
        { id: 'input-right', direction: 'input', type: 'R' },
        { id: 'output-match', direction: 'output', type: 'J' },
      ];
      const joinIssues = (config: ToolConfig) =>
        messages(
          validateWorkflow(
            [reader('l'), reader('r'), makeTool('j', 'Join', config, sockets), writer()],
            [
              wire('l', 'j', 'output', 'input-left'),
              wire('r', 'j', 'output', 'input-right'),
              wire('j', 'out', 'output-match'),
            ]
          ).filter((i) => i.toolId === 'j')
        );
      expect(joinIssues({ joinType: 'inner', leftKeys: [], rightKeys: [] })).toEqual([
        'Choose the key column(s) to join on for both inputs.',
      ]);
      expect(joinIssues({ joinType: 'inner', leftKeys: ['a', 'b'], rightKeys: ['a'] })).toEqual([
        'The left and right inputs need the same number of key columns.',
      ]);
      expect(joinIssues({ joinType: 'cross', leftKeys: [], rightKeys: [] })).toEqual([]);
      expect(joinIssues({ joinType: 'inner', leftKeys: ['a'], rightKeys: ['a'] })).toEqual([]);
    });

    it('rejects the default blank aggregation', () => {
      const blank = makeTool('s', 'Summarize', {
        groupByColumns: [],
        aggregations: [{ column: '', operation: 'Sum', outputName: '' }],
      });
      expect(messages(run(blank))).toContain('Every aggregation needs a column and an operation.');
      const ok = makeTool('s', 'Summarize', {
        groupByColumns: ['g'],
        aggregations: [{ column: 'a', operation: 'Sum', outputName: 'a_sum' }],
      });
      expect(run(ok)).toEqual([]);
    });

    it('requires pivot and unpivot columns', () => {
      expect(messages(run(makeTool('p', 'Pivot', { on: '', values: '', index: [] })))).toHaveLength(2);
      expect(messages(run(makeTool('u', 'Unpivot', { on: [] })))).toEqual([
        'Choose at least one column to unpivot.',
      ]);
    });
  });

  it('warns when concatenate has fewer than two inputs', () => {
    const union = makeTool('u', 'Union', { mode: 'ByName' }, [{ ...input, multiple: true }, output]);
    const issues = validateWorkflow([reader(), union, writer()], [wire('in', 'u'), wire('u', 'out')]);
    expect(forTool(issues, 'u')).toHaveLength(1);
    expect(forTool(issues, 'u')[0]!.severity).toBe('warning');
  });

  it('warns when two Write tools share a destination', () => {
    const issues = validateWorkflow(
      [reader(), writer('w1'), writer('w2')],
      [wire('in', 'w1'), wire('in', 'w2')]
    );
    expect(forTool(issues, 'w1')).toHaveLength(1);
    expect(forTool(issues, 'w2')).toHaveLength(1);
    expect(forTool(issues, 'w1')[0]!.severity).toBe('warning');
  });

  it('numbers duplicate tool labels and uses the label callback', () => {
    const tools = [reader(), makeTool('f1', 'Filter'), makeTool('f2', 'Filter'), writer()];
    const issues = validateWorkflow(tools, [wire('in', 'f1'), wire('in', 'f2')], {
      toolLabel: (tool) => (tool.type === 'Filter' ? 'Filter' : tool.type),
    });
    expect(forTool(issues, 'f1')[0]!.toolLabel).toBe('Filter 1');
    expect(forTool(issues, 'f2')[0]!.toolLabel).toBe('Filter 2');
  });

  it('lists errors before warnings with unique ids', () => {
    const issues = validateWorkflow([reader('in', { source: '' }), makeTool('f', 'Filter')], []);
    const firstWarning = issues.findIndex((i) => i.severity === 'warning');
    const lastError = issues.map((i) => i.severity).lastIndexOf('error');
    expect(lastError).toBeLessThan(firstWarning);
    expect(new Set(issues.map((i) => i.id)).size).toBe(issues.length);
  });
});

describe('summaries', () => {
  it('counts and describes issues', () => {
    const issues: ValidationIssue[] = [
      { id: '1', severity: 'error', message: 'a' },
      { id: '2', severity: 'error', message: 'b' },
      { id: '3', severity: 'warning', message: 'c' },
    ];
    expect(summarizeIssues(issues)).toEqual({ errors: 2, warnings: 1 });
    expect(describeSummary({ errors: 2, warnings: 1 })).toBe('2 errors, 1 warning');
    expect(describeSummary({ errors: 1, warnings: 0 })).toBe('1 error');
    expect(describeSummary({ errors: 0, warnings: 3 })).toBe('3 warnings');
  });
});
