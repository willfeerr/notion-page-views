import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('App shell Notion-first board relation contract', () => {
  it('does not reintroduce Board placement pseudo-block wiring', () => {
    const source = readFileSync(resolve(currentDir, 'App.tsx'), 'utf8');

    expect(source).not.toContain('BoardLinkOption');
    expect(source).not.toContain('BoardLinkValue');
    expect(source).not.toContain('openPageBoard');
    expect(source).not.toContain('boardOptions');
    expect(source).not.toContain('boardPlacement');
    expect(source).not.toContain('onBoardPlacementChange');
    expect(source).not.toContain('updateBoardPlacement');
  });
});
