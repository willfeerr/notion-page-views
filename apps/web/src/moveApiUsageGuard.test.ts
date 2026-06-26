import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));
const allowedFiles = new Set([
  'workspaceYjs.ts',
  'workspaceYjs.test.ts',
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

describe('legacy move API usage', () => {
  it('keeps linkPage/unlinkPage out of UI and property components', () => {
    const offenders = sourceFiles(srcDir)
      .filter((path) => !allowedFiles.has(relative(srcDir, path)))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return /\.linkPage\s*\(/.test(source) || /\.unlinkPage\s*\(/.test(source);
      })
      .map((path) => relative(srcDir, path));

    expect(offenders).toEqual([]);
  });
});
