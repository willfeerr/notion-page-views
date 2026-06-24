import { describe, expect, it } from 'vitest';
import { WorkspaceComponentNode } from './WorkspaceComponentNode';

describe('WorkspaceComponentNode', () => {
  it('stores an internal reference without an embed URL', () => {
    const value = new WorkspaceComponentNode('board', 'board-roadmap', 'Roadmap').exportJSON();

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
