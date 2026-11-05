/**
 * Every `*-theme-<name>` utility used in a component must name a color that
 * tailwind.config.js defines. Tailwind silently emits nothing for an unknown
 * name, so a typo leaves an element without its border, background or focus
 * ring instead of failing the build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(__dirname, '..', '..');

const UTILITY_PREFIXES = [
  'bg', 'text', 'border', 'border-t', 'border-b', 'border-l', 'border-r',
  'border-x', 'border-y', 'ring', 'ring-offset', 'outline', 'divide', 'fill',
  'stroke', 'from', 'via', 'to', 'accent', 'caret', 'placeholder', 'decoration',
  'shadow',
];

const CLASS_PATTERN = new RegExp(
  `(?<![\\w-])(?:${UTILITY_PREFIXES.join('|')})-theme-([a-z0-9-]+?)(?:/\\d+)?(?![\\w-])`,
  'g'
);

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      files.push(...listSourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

interface TailwindConfig {
  theme: { extend: { colors: { theme: Record<string, string> } } };
}

describe('theme utility classes', async () => {
  // The config is plain JS without type declarations.
  const configPath: string = '../../../tailwind.config.js';
  const { default: tailwindConfig } = (await import(configPath)) as { default: TailwindConfig };
  const defined = new Set(Object.keys(tailwindConfig.theme.extend.colors.theme));

  it('defines a non-trivial set of theme colors', () => {
    expect(defined.size).toBeGreaterThan(50);
  });

  it('uses only theme colors that tailwind.config.js defines', () => {
    const unknown: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(CLASS_PATTERN)) {
        if (!defined.has(match[1] ?? '')) {
          unknown.push(`${relative(SRC_DIR, file)}: ${match[0]}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});
