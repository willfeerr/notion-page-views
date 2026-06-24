import { describe, expect, it } from 'vitest';
import type { SerializedEditorState } from 'lexical';
import { createBlockIdentityIndex, withStableBlockIds } from '../notion-page/editor/blockIdentity';
import { buildWorkspaceBacklinkIndex, collectWorkspaceBacklinks } from './backlinks';

function editorState(children: unknown[]): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children,
    },
  } as SerializedEditorState;
}

function paragraph(text: string) {
  return {
    type: 'paragraph',
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children: [{ type: 'text', version: 1, text, format: 0, style: '', detail: 0, mode: 'normal' }],
  };
}

function workspaceComponent(componentType: 'page' | 'board', targetId: string, title: string) {
  return { type: 'workspace-component', version: 1, componentType, targetId, title };
}

describe('block identity', () => {
  it('creates a stable block index for serialized editor state', () => {
    let next = 0;
    const state = editorState([paragraph('Primeiro bloco'), paragraph('Segundo bloco')]);
    const indexed = createBlockIdentityIndex(state, {
      pageId: 'page-a',
      now: '2026-06-24T00:00:00.000Z',
      createId: () => `block-${++next}`,
    });

    expect(indexed.blocks.map((block) => block.id)).toEqual(['block-1', 'block-2']);
    expect(indexed.blocks.map((block) => block.text)).toEqual(['Primeiro bloco', 'Segundo bloco']);
    expect(indexed.blocks.every((block) => block.pageId === 'page-a')).toBe(true);
  });

  it('keeps the same id when a block is edited in the same structural position', () => {
    let next = 0;
    const first = createBlockIdentityIndex(editorState([paragraph('Texto original')]), {
      createId: () => `block-${++next}`,
      now: '2026-06-24T00:00:00.000Z',
    });
    const second = createBlockIdentityIndex(editorState([paragraph('Texto original editado')]), {
      previous: first,
      createId: () => `block-${++next}`,
      now: '2026-06-24T00:00:01.000Z',
    });

    expect(second.blocks[0]?.id).toBe(first.blocks[0]?.id);
    expect(second.blocks[0]?.text).toBe('Texto original editado');
  });

  it('attaches the block index to the saved editor snapshot', () => {
    const snapshot = withStableBlockIds(editorState([paragraph('Persistido')]), {
      createId: () => 'block-fixed',
      now: '2026-06-24T00:00:00.000Z',
    });

    expect(snapshot.blockIndex?.blocks[0]?.id).toBe('block-fixed');
  });
});

describe('workspace backlinks', () => {
  it('indexes internal page and board components by target', () => {
    let next = 0;
    const content = withStableBlockIds(editorState([
      workspaceComponent('page', 'page-target', 'Pagina alvo'),
      workspaceComponent('board', 'board-target', 'Board alvo'),
    ]), {
      createId: () => `block-${++next}`,
      now: '2026-06-24T00:00:00.000Z',
    });

    const backlinks = collectWorkspaceBacklinks('source-page', content);
    expect(backlinks).toEqual([
      { sourcePageId: 'source-page', targetId: 'page-target', targetType: 'page', blockId: 'block-1', label: 'Pagina alvo' },
      { sourcePageId: 'source-page', targetId: 'board-target', targetType: 'board', blockId: 'block-2', label: 'Board alvo' },
    ]);

    const index = buildWorkspaceBacklinkIndex([{ id: 'source-page', content }]);
    expect(index.get('page:page-target')).toHaveLength(1);
    expect(index.get('board:board-target')).toHaveLength(1);
  });
});
