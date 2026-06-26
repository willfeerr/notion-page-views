import { describe, expect, it } from 'vitest';
import type { SerializedEditorState } from 'lexical';
import { hasSerializedEditorContent } from './SerializedStateSyncPlugin';

function state(children: unknown[]): SerializedEditorState {
  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as SerializedEditorState;
}

describe('hasSerializedEditorContent', () => {
  it('treats a blank paragraph as empty', () => {
    expect(hasSerializedEditorContent(state([
      { children: [], direction: null, format: '', indent: 0, type: 'paragraph', version: 1 },
    ]))).toBe(false);
  });

  it('detects text content', () => {
    expect(hasSerializedEditorContent(state([
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Conteudo salvo', type: 'text', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ]))).toBe(true);
  });

  it('detects non-text semantic blocks', () => {
    expect(hasSerializedEditorContent(state([
      { children: [], direction: null, format: '', indent: 0, type: 'workspace-component', version: 1, targetId: 'board-roadmap' },
      { children: [], direction: null, format: '', indent: 0, type: 'image', version: 1, url: 'https://example.com/image.png' },
    ]))).toBe(true);
  });
});
