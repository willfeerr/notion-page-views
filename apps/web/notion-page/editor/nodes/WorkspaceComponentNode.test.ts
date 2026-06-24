import { describe, expect, it } from 'vitest';
import { createEditor } from 'lexical';
import { WorkspaceComponentNode } from './WorkspaceComponentNode';

describe('WorkspaceComponentNode', () => {
  it('stores an internal reference without an embed URL', () => {
    const editor = createEditor({
      namespace: 'workspace-component-test',
      nodes: [WorkspaceComponentNode],
      onError(error) { throw error; },
    });
    let value: ReturnType<WorkspaceComponentNode['exportJSON']> | undefined;
    editor.update(() => {
      value = new WorkspaceComponentNode('board', 'board-roadmap', 'Roadmap').exportJSON();
    }, { discrete: true });

    expect(value).toMatchObject({
      type: 'workspace-component',
      version: 1,
      componentType: 'board',
      targetId: 'board-roadmap',
      title: 'Roadmap',
    });
    expect(value).not.toHaveProperty('url');
  });
});
