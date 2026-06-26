import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App shell Notion-first board relation contract', () => {
  it('does not reintroduce Board placement pseudo-block wiring', () => {
    const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

    expect(source).not.toContain('BoardLinkOption');
    expect(source).not.toContain('BoardLinkValue');
    expect(source).not.toContain('openPageBoard');
    expect(source).not.toContain('boardOptions');
    expect(source).not.toContain('boardPlacement');
    expect(source).not.toContain('onBoardPlacementChange');
    expect(source).not.toContain('updateBoardPlacement');
  });
});
