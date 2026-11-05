import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const studioSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOTS = ['ai', 'components/ai', 'state/aiStore.ts'];

function sourceFiles(path: string): string[] {
  if (statSync(path).isFile()) return /\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => (name === '__fixtures__' ? [] : sourceFiles(join(path, name))));
}

describe('AI assistant sources', () => {
  // Prompts, tool results and chat text are plain ASCII: no arrows, dashes
  // or symbols that models and terminals render inconsistently.
  it('are plain ASCII', () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap((r) => sourceFiles(join(studioSrc, r)))) {
      readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        if ([...line].some((ch) => ch.charCodeAt(0) > 0x7f)) offenders.push(`${relative(studioSrc, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
